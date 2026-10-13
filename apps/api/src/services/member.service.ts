import { prisma } from '../prisma.js';
import { AppError } from '../middlewares/error.middleware.js';
import { activityService } from './activity.service.js';
import { ActivityType, ProjectRole } from '../generated/prisma/index.js';
import { publishToProject, evictUserFromProjectRoom, notifyUserRoleUpdated } from '../realtime/realtime.service.js';

export class MemberService {
  /**
   * Helper to verify if user has access and whether they are an admin
   */
  private static async verifyProjectAccess(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        workspace: {
          select: {
            id: true,
            ownerId: true,
            members: { where: { userId } },
          },
        },
        members: { where: { userId } },
      },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const isWsOwner = project.workspace.ownerId === userId;
    const isWsAdmin = project.workspace.members[0]?.role === 'WORKSPACE_ADMIN';
    const membership = project.members[0];

    if (!membership && !isWsOwner && !isWsAdmin) {
      throw new AppError('You are not a member of this project', 403);
    }

    const role: ProjectRole = membership?.role || (isWsOwner || isWsAdmin ? 'PROJECT_ADMIN' : 'PROJECT_MEMBER');
    const isAdmin = role === 'PROJECT_ADMIN';
    const isOwner = isWsOwner;

    return { project, isOwner, membership, role, isAdmin, isWsOwner, isWsAdmin };
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

    // If demoting from ADMIN to MEMBER, ensure at least one other admin exists or workspace owner/admin
    if (targetMember.role === 'PROJECT_ADMIN' && newRole === 'PROJECT_MEMBER' && !isWsOwner && !isWsAdmin) {
      const adminCount = await prisma.projectMember.count({
        where: { projectId, role: 'PROJECT_ADMIN' },
      });

      if (adminCount <= 1) {
        throw new AppError('Cannot demote the only project administrator', 400);
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

    // If target is admin, make sure there is another admin or workspace owner/admin
    if (targetMember.role === 'PROJECT_ADMIN' && !isWsOwner && !isWsAdmin) {
      const adminCount = await prisma.projectMember.count({
        where: { projectId, role: 'PROJECT_ADMIN' },
      });

      if (adminCount <= 1) {
        throw new AppError('Cannot remove the only project administrator', 400);
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
}

export const memberService = MemberService;
