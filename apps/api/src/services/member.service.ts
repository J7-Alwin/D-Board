import { prisma } from '../prisma.js';
import { AppError } from '../middlewares/error.middleware.js';
import { activityService } from './activity.service.js';
import { ActivityType, ProjectRole } from '../generated/prisma/index.js';
import { publishToProject, evictUserFromProjectRoom, notifyUserRoleUpdated } from '../realtime/realtime.service.js';
import { projectService } from './project.service.js';

export class MemberService {
  /**
   * Helper to verify if user has access and whether they are an admin
   */
  private static async verifyProjectAccess(projectId: string, userId: string) {
    const access = await projectService.verifyProjectAccess(projectId, userId);
    return {
      project: access.project,
      isOwner: access.isWsOwner,
      membership: access.membership,
      role: access.role,
      isAdmin: access.isAdmin,
      isWsOwner: access.isWsOwner,
      isWsAdmin: access.isWsAdmin,
    };
  }

  /**
   * Get all active members for a project
   */
  static async getProjectMembers(projectId: string, userId: string) {
    const { project, isAdmin } = await this.verifyProjectAccess(projectId, userId);

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });

    // Also get creator info
    const creator = await prisma.user.findUnique({
      where: { id: project.createdById },
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
        avatarUrl: true,
      },
    });

    // If caller is admin, also fetch pending invitations
    const pendingInvitations = isAdmin
      ? await prisma.invitation.findMany({
          where: { projectId, status: 'PENDING' },
          include: {
            invitedBy: {
              select: { id: true, fullName: true, username: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    return {
      project: {
        id: project.id,
        name: project.name,
        key: project.key,
        createdById: project.createdById,
        creator,
      },
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        user: m.user,
        isCreator: m.userId === project.createdById,
      })),
      pendingInvitations,
      currentUserRole: isAdmin ? 'PROJECT_ADMIN' : 'PROJECT_MEMBER',
    };
  }

  /**
   * Add an existing workspace member directly into the project (Admin only)
   */
  static async addMember(
    projectId: string,
    actorId: string,
    payload: { userId?: string; email?: string; role?: ProjectRole }
  ) {
    const { project, isAdmin } = await this.verifyProjectAccess(projectId, actorId);
    if (!isAdmin) {
      throw new AppError('Only project administrators can add members to this project', 403);
    }

    if (project.status === 'ARCHIVED') {
      throw new AppError('Cannot add members to an archived project', 400);
    }

    let targetUser: any = null;
    if (payload.userId) {
      targetUser = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, fullName: true, username: true, isDeactivated: true },
      });
    } else if (payload.email) {
      targetUser = await prisma.user.findUnique({
        where: { email: payload.email.toLowerCase().trim() },
        select: { id: true, email: true, fullName: true, username: true, isDeactivated: true },
      });
    }

    if (!targetUser || targetUser.isDeactivated) {
      throw new AppError('User not found or account is deactivated', 404);
    }

    // Target user must be an active member or owner of the workspace
    const isWsOwner = project.workspace?.ownerId === targetUser.id;
    const wsMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: project.workspaceId,
          userId: targetUser.id,
        },
      },
    });

    if (!isWsOwner && !wsMember) {
      throw new AppError('The user must be an active member of this workspace to be added to this project', 400);
    }

    const assignedRole: ProjectRole = payload.role === 'PROJECT_ADMIN' ? 'PROJECT_ADMIN' : 'PROJECT_MEMBER';

    const member = await prisma.$transaction(async (tx) => {
      const existing = await tx.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: targetUser.id,
          },
        },
        include: {
          user: {
            select: { id: true, fullName: true, username: true, email: true, avatarUrl: true },
          },
        },
      });

      if (existing) {
        if (existing.role !== assignedRole) {
          return await tx.projectMember.update({
            where: { id: existing.id },
            data: { role: assignedRole },
            include: {
              user: {
                select: { id: true, fullName: true, username: true, email: true, avatarUrl: true },
              },
            },
          });
        }
        return existing;
      }

      const created = await tx.projectMember.create({
        data: {
          projectId,
          userId: targetUser.id,
          role: assignedRole,
        },
        include: {
          user: {
            select: { id: true, fullName: true, username: true, email: true, avatarUrl: true },
          },
        },
      });

      // Mark any pending invitations for this user as ACCEPTED
      await tx.invitation.updateMany({
        where: {
          projectId,
          OR: [
            { invitedUserId: targetUser.id },
            { invitedEmail: targetUser.email.toLowerCase() },
          ],
          status: 'PENDING',
        },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          invitedUserId: targetUser.id,
        },
      });

      await activityService.createActivity(
        {
          projectId,
          actorId,
          type: ActivityType.MEMBER_ADDED,
          metadata: {
            addedUserId: targetUser.id,
            addedUserName: targetUser.fullName || targetUser.username,
            role: assignedRole,
          },
        },
        tx
      );

      // Notification
      await tx.notification.create({
        data: {
          recipientId: targetUser.id,
          actorId,
          projectId,
          type: 'SYSTEM',
          title: 'Added to Project',
          message: `You were added to "${project.name}" as ${assignedRole === 'PROJECT_ADMIN' ? 'Project Administrator' : 'Project Member'}.`,
          link: `/app/projects/${projectId}`,
        },
      }).catch(() => {});

      return created;
    });

    publishToProject(projectId, 'MEMBER_ADDED', {
      projectId,
      memberId: member.id,
      userId: member.userId,
      role: member.role,
      actorId,
    });

    return member;
  }

  /**
   * Update a member's role (Admin only)
   */
  static async updateMemberRole(
    projectId: string,
    targetMemberId: string,
    newRole: ProjectRole,
    actorId: string
  ) {
    const { project, isAdmin, isWsOwner, isWsAdmin } = await this.verifyProjectAccess(projectId, actorId);

    if (!isAdmin) {
      throw new AppError('Only project administrators can modify member roles', 403);
    }

    const targetMember = await prisma.projectMember.findUnique({
      where: { id: targetMemberId },
      include: { user: true },
    });

    if (!targetMember || targetMember.projectId !== projectId) {
      throw new AppError('Member not found in this project', 404);
    }

    // Protect project creator (unless workspace owner/admin)
    if (targetMember.userId === project.createdById && newRole !== 'PROJECT_ADMIN' && !isWsOwner && !isWsAdmin) {
      throw new AppError('Cannot demote the project creator from administrator role', 400);
    }

    // If demoting from ADMIN to MEMBER, ensure at least one other designated project admin exists
    if (targetMember.role === 'PROJECT_ADMIN' && newRole === 'PROJECT_MEMBER' && !isWsOwner && !isWsAdmin) {
      const adminCount = await prisma.projectMember.count({
        where: { projectId, role: 'PROJECT_ADMIN' },
      });

      if (adminCount <= 1) {
        throw new AppError('Cannot demote the only designated project administrator without appointing an active replacement. Please use the administrative handover workflow.', 400);
      }
    }

    const updated = await prisma.projectMember.update({
      where: { id: targetMemberId },
      data: { role: newRole },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    publishToProject(projectId, 'MEMBER_ROLE_CHANGED', {
      projectId,
      memberId: updated.id,
      userId: updated.userId,
      role: updated.role,
      actorId,
    });

    await notifyUserRoleUpdated(updated.userId, projectId, updated.role);

    return updated;
  }

  /**
   * Remove a member from the project (Admin only)
   */
  static async removeMember(projectId: string, targetMemberId: string, actorId: string) {
    const { project, isAdmin, isWsOwner, isWsAdmin } = await this.verifyProjectAccess(projectId, actorId);

    if (!isAdmin) {
      throw new AppError('Only project administrators can remove members', 403);
    }

    const targetMember = await prisma.projectMember.findUnique({
      where: { id: targetMemberId },
      include: { user: true },
    });

    if (!targetMember || targetMember.projectId !== projectId) {
      throw new AppError('Member not found in this project', 404);
    }

    // Cannot remove project creator (unless workspace owner/admin)
    if (targetMember.userId === project.createdById && !isWsOwner && !isWsAdmin) {
      throw new AppError('Cannot remove the project creator from the project', 400);
    }

    // Protect last designated PROJECT_ADMIN from removal without replacement
    if (targetMember.role === 'PROJECT_ADMIN' && !isWsOwner && !isWsAdmin) {
      const adminCount = await prisma.projectMember.count({
        where: { projectId, role: 'PROJECT_ADMIN' },
      });

      if (adminCount <= 1) {
        throw new AppError('Cannot remove the only designated project administrator without appointing an active replacement. Please use the administrative handover workflow.', 400);
      }
    }

    // Delete membership, revoke derived workspace access if last project, and log activity
    await prisma.$transaction(async (tx) => {
      // Unassign target member from work items in this project (preserve item and creator attribution)
      await tx.workItem.updateMany({
        where: { projectId, assignedToId: targetMember.userId },
        data: { assignedToId: null },
      });

      await tx.projectMember.delete({
        where: { id: targetMemberId },
      });

      // Lifecycle check: If target user had ONLY a legacy project-derived workspace membership,
      // revoke workspace membership when they have no remaining projects in the workspace.
      // Preserves independent direct members (origin === 'DIRECT') and workspace admins/owners.
      const wsMember = await tx.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: project.workspaceId,
            userId: targetMember.userId,
          },
        },
      });

      if (
        wsMember &&
        wsMember.origin === 'PROJECT_DERIVED' &&
        wsMember.role === 'WORKSPACE_MEMBER'
      ) {
        const remainingMemberships = await tx.projectMember.count({
          where: {
            userId: targetMember.userId,
            project: { workspaceId: project.workspaceId },
          },
        });

        const remainingOwnedProjects = await tx.project.count({
          where: {
            workspaceId: project.workspaceId,
            createdById: targetMember.userId,
          },
        });

        if (remainingMemberships === 0 && remainingOwnedProjects === 0) {
          await tx.workspaceMember.delete({
            where: {
              workspaceId_userId: {
                workspaceId: project.workspaceId,
                userId: targetMember.userId,
              },
            },
          });

          await tx.invitation.updateMany({
            where: {
              project: { workspaceId: project.workspaceId },
              OR: [
                { invitedUserId: targetMember.userId },
                { invitedEmail: targetMember.user.email.toLowerCase() },
              ],
              status: 'PENDING',
            },
            data: {
              status: 'CANCELLED',
              cancelledAt: new Date(),
            },
          });
        }
      }

      await activityService.createActivity(
        {
          projectId,
          actorId,
          type: ActivityType.MEMBER_REMOVED,
          metadata: {
            removedUserId: targetMember.userId,
            removedUserName: targetMember.user.fullName || targetMember.user.username,
          },
        },
        tx
      );
    });

    publishToProject(projectId, 'MEMBER_REMOVED', {
      projectId,
      memberId: targetMemberId,
      userId: targetMember.userId,
      actorId,
    });

    // Revoke real-time room membership immediately
    await evictUserFromProjectRoom(targetMember.userId, projectId);

    return { success: true, message: 'Member removed from project' };
  }

  /**
   * Get project admin handover summary (showing incomplete tasks, eligible replacements, and last admin status)
   */
  static async getHandoverSummary(projectId: string, targetMemberId: string, actorId: string) {
    const { project, isAdmin } = await this.verifyProjectAccess(projectId, actorId);
    if (!isAdmin) {
      throw new AppError('Only project administrators can inspect handover details', 403);
    }

    const targetMember = await prisma.projectMember.findUnique({
      where: { id: targetMemberId },
      include: {
        user: {
          select: { id: true, fullName: true, username: true, email: true, avatarUrl: true },
        },
      },
    });

    if (!targetMember || targetMember.projectId !== projectId) {
      throw new AppError('Member not found in this project', 404);
    }

    const adminCount = await prisma.projectMember.count({
      where: { projectId, role: 'PROJECT_ADMIN' },
    });

    const isLastAdmin = targetMember.role === 'PROJECT_ADMIN' && adminCount <= 1;

    // Incomplete tasks assigned to the target admin
    const incompleteTasks = await prisma.workItem.findMany({
      where: {
        projectId,
        assignedToId: targetMember.userId,
        status: { not: 'COMPLETED' },
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        createdAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Completed tasks count (preserved with original attribution)
    const completedTasksCount = await prisma.workItem.count({
      where: {
        projectId,
        assignedToId: targetMember.userId,
        status: 'COMPLETED',
      },
    });

    // Project members available for task reassignment
    const projectMembers = await prisma.projectMember.findMany({
      where: {
        projectId,
        userId: { not: targetMember.userId },
      },
      include: {
        user: {
          select: { id: true, fullName: true, username: true, email: true, avatarUrl: true },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });

    // Eligible replacements from workspace
    const workspaceMembers = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: project.workspaceId,
        userId: { not: targetMember.userId },
        user: { isDeactivated: false },
      },
      include: {
        user: {
          select: { id: true, fullName: true, username: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return {
      member: targetMember,
      isLastAdmin,
      adminCount,
      incompleteTasks,
      completedTasksCount,
      projectMembers: projectMembers.map((pm) => ({
        id: pm.id,
        userId: pm.userId,
        role: pm.role,
        user: pm.user,
      })),
      eligibleReplacements: workspaceMembers.map((wm) => ({
        userId: wm.userId,
        workspaceRole: wm.role,
        user: wm.user,
        isProjectMember: projectMembers.some((pm) => pm.userId === wm.userId),
      })),
    };
  }

  /**
   * Execute a controlled project admin handover
   */
  static async executeHandover(
    projectId: string,
    targetMemberId: string,
    actorId: string,
    payload: {
      action: 'DEMOTE' | 'REMOVE';
      replacementUserId?: string;
      reassignTasksToUserId?: string;
      note?: string;
    }
  ) {
    const { project, isAdmin, isWsOwner, isWsAdmin } = await this.verifyProjectAccess(projectId, actorId);
    if (!isAdmin) {
      throw new AppError('Only project administrators can execute an administrator handover', 403);
    }

    const targetMember = await prisma.projectMember.findUnique({
      where: { id: targetMemberId },
      include: { user: true },
    });

    if (!targetMember || targetMember.projectId !== projectId) {
      throw new AppError('Member not found in this project', 404);
    }

    // Protect project creator from removal unless workspace owner/admin
    if (targetMember.userId === project.createdById && payload.action === 'REMOVE' && !isWsOwner && !isWsAdmin) {
      throw new AppError('Cannot remove the project creator from the project', 400);
    }

    const adminCount = await prisma.projectMember.count({
      where: { projectId, role: 'PROJECT_ADMIN' },
    });

    const isLastAdmin = targetMember.role === 'PROJECT_ADMIN' && adminCount <= 1;

    if (isLastAdmin && !payload.replacementUserId) {
      throw new AppError('Cannot demote or remove the last project administrator without appointing an active replacement', 400);
    }

    return await prisma.$transaction(async (tx) => {
      let replacementMember: any = null;

      // 1. If replacement admin designated, validate and promote/add them
      if (payload.replacementUserId) {
        if (payload.replacementUserId === targetMember.userId) {
          throw new AppError('Replacement administrator cannot be the departing member', 400);
        }

        const replacementWsMember = await tx.workspaceMember.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId: project.workspaceId,
              userId: payload.replacementUserId,
            },
          },
          include: { user: true },
        });

        if (!replacementWsMember || replacementWsMember.user.isDeactivated) {
          throw new AppError('Replacement administrator must be an active member of this workspace', 400);
        }

        const existingProjectMember = await tx.projectMember.findUnique({
          where: {
            projectId_userId: {
              projectId,
              userId: payload.replacementUserId,
            },
          },
        });

        if (existingProjectMember) {
          replacementMember = await tx.projectMember.update({
            where: { id: existingProjectMember.id },
            data: { role: 'PROJECT_ADMIN' },
          });
        } else {
          replacementMember = await tx.projectMember.create({
            data: {
              projectId,
              userId: payload.replacementUserId,
              role: 'PROJECT_ADMIN',
            },
          });
        }
      }

      // 2. Incomplete tasks reassignment (preserving creator attribution and completed tasks)
      const incompleteTasks = await tx.workItem.findMany({
        where: {
          projectId,
          assignedToId: targetMember.userId,
          status: { not: 'COMPLETED' },
        },
        select: { id: true, title: true },
      });

      let reassignedCount = 0;
      if (payload.reassignTasksToUserId && incompleteTasks.length > 0) {
        // Validate reassign target is an active workspace member
        const reassignWsMember = await tx.workspaceMember.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId: project.workspaceId,
              userId: payload.reassignTasksToUserId,
            },
          },
        });
        if (!reassignWsMember) {
          throw new AppError('Task reassignment recipient must be an active member of this workspace', 400);
        }

        const updateResult = await tx.workItem.updateMany({
          where: {
            projectId,
            assignedToId: targetMember.userId,
            status: { not: 'COMPLETED' },
          },
          data: { assignedToId: payload.reassignTasksToUserId },
        });
        reassignedCount = updateResult.count;
      } else if (payload.action === 'REMOVE' && incompleteTasks.length > 0) {
        // Unassign without deleting work items
        await tx.workItem.updateMany({
          where: {
            projectId,
            assignedToId: targetMember.userId,
            status: { not: 'COMPLETED' },
          },
          data: { assignedToId: null },
        });
      }

      // 3. Execute role change or removal
      let updatedRole: string | null = null;
      if (payload.action === 'DEMOTE') {
        const demoted = await tx.projectMember.update({
          where: { id: targetMemberId },
          data: { role: 'PROJECT_MEMBER' },
        });
        updatedRole = demoted.role;
      } else {
        await tx.projectMember.delete({
          where: { id: targetMemberId },
        });

        // Unassign any remaining tasks
        await tx.workItem.updateMany({
          where: { projectId, assignedToId: targetMember.userId },
          data: { assignedToId: null },
        });

        // Check project-derived workspace membership cascade
        const wsMember = await tx.workspaceMember.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId: project.workspaceId,
              userId: targetMember.userId,
            },
          },
        });

        if (
          wsMember &&
          wsMember.origin === 'PROJECT_DERIVED' &&
          wsMember.role === 'WORKSPACE_MEMBER'
        ) {
          const remainingMemberships = await tx.projectMember.count({
            where: {
              userId: targetMember.userId,
              project: { workspaceId: project.workspaceId },
            },
          });
          const remainingOwnedProjects = await tx.project.count({
            where: {
              workspaceId: project.workspaceId,
              createdById: targetMember.userId,
            },
          });
          if (remainingMemberships === 0 && remainingOwnedProjects === 0) {
            await tx.workspaceMember.delete({
              where: { id: wsMember.id },
            });
          }
        }
      }

      // 4. Log Activity record recording handover details
      await tx.activity.create({
        data: {
          projectId,
          actorId,
          type: payload.action === 'DEMOTE' ? ActivityType.MEMBER_ADDED : ActivityType.MEMBER_REMOVED,
          metadata: {
            handover: true,
            action: payload.action,
            departingUserId: targetMember.userId,
            departingUserName: targetMember.user.fullName || targetMember.user.username,
            replacementUserId: payload.replacementUserId || null,
            reassignTasksToUserId: payload.reassignTasksToUserId || null,
            reassignedTasksCount: reassignedCount,
            note: payload.note || null,
            timestamp: new Date().toISOString(),
          },
        },
      });

      // 5. Notify replacement administrator
      if (payload.replacementUserId) {
        await tx.notification.create({
          data: {
            recipientId: payload.replacementUserId,
            actorId,
            projectId,
            type: 'SYSTEM',
            title: 'Appointed as Project Administrator',
            message: `You have been appointed as Project Administrator for "${project.name}" during an administrative handover.`,
            link: `/app/projects/${projectId}/members`,
          },
        }).catch(() => {});
      }

      return {
        success: true,
        action: payload.action,
        departingUserId: targetMember.userId,
        replacementUserId: payload.replacementUserId || null,
        reassignedTasksCount: reassignedCount,
        message: `Handover completed successfully: ${payload.action === 'DEMOTE' ? 'member demoted to Project Member' : 'member removed from project'}.`,
      };
    });
  }
}

export const memberService = MemberService;
