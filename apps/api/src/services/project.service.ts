import crypto from 'node:crypto';
import { prisma } from '../prisma.js';
import { CreateProjectInput, UpdateProjectInput } from '../schemas/project.schema.js';
import { AppError } from '../middlewares/error.middleware.js';
import { enqueueEmailJob, enqueueCleanupJob } from '../jobs/queues.js';
import { workspaceService } from './workspace.service.js';
import { authService } from './auth.service.js';
import { resolveAdminPermissions, resolveFullWorkspacePermissions } from '../schemas/workspace.schema.js';

export class ProjectService {
  /**
   * Atomic project creation transaction:
   * 1. Validate workspace membership or provision personal workspace
   * 2. Create Project scoped to workspace
   * 3. Create ProjectMember for creator as PROJECT_ADMIN
   * 4. Create pending invitations (if any)
   * 5. Post-commit: Enqueue invitation emails via BullMQ
   */
  async createProject(
    userId: string,
    data: CreateProjectInput & { workspaceId?: string },
    explicitWorkspaceId?: string
  ) {
    let targetWorkspaceId = explicitWorkspaceId || (data as any).workspaceId;
    if (targetWorkspaceId) {
      const wsAccess = await workspaceService.verifyWorkspaceAccess(targetWorkspaceId, userId);
      const ws = await prisma.workspace.findUnique({
        where: { id: targetWorkspaceId },
        select: { id: true, isPersonal: true, ownerId: true, name: true, adminPermissions: true, deletedAt: true },
      });

      if (!ws || ws.deletedAt) {
        throw new AppError('Workspace not found', 404);
      }

      // Workspace role check for project creation:
      const permissions = resolveFullWorkspacePermissions(ws);
      if (ws.isPersonal) {
        if (ws.ownerId !== userId) {
          throw new AppError('Only the workspace owner can create projects in a personal workspace', 403);
        }
      } else {
        if (wsAccess.role === 'OWNER') {
          // Owner can always create projects
        } else if (wsAccess.role === 'WORKSPACE_ADMIN') {
          if (!permissions.workspaceAdmin.canCreateProjects) {
            throw new AppError('Workspace administrator does not have permission to create projects in this workspace', 403);
          }
        } else if (wsAccess.role === 'PROJECT_ADMIN') {
          if (!permissions.projectAdmin.canCreateProjects) {
            throw new AppError('Project administrators do not have permission to create projects in this workspace', 403);
          }
        } else if (wsAccess.role === 'WORKSPACE_MEMBER') {
          if (!permissions.workspaceMember.canCreateProjects) {
            throw new AppError('Workspace members cannot create projects: you do not have permission to create projects in this workspace', 403);
          }
        } else {
          throw new AppError('You do not have permission to create projects in this workspace', 403);
        }
      }
    } else {
      const personalWs = await authService.ensurePersonalWorkspace(userId);
      targetWorkspaceId = personalWs.id;
    }

    const pendingEmailDispatches: Array<{
      email: string;
      role: string;
      message: string | null;
      expiresAt: Date;
    }> = [];

    const fullProject = await prisma.$transaction(async (tx) => {
      // Re-verify target workspace is not deleted inside the transaction
      const targetWs = await tx.workspace.findUnique({
        where: { id: targetWorkspaceId },
        select: { id: true, isPersonal: true, deletedAt: true },
      });
      if (!targetWs || targetWs.deletedAt) {
        throw new AppError('Workspace not found', 404);
      }

      const rawVis = data.visibility ? String(data.visibility).toUpperCase() : 'WORKSPACE';
      let normVisibility: 'WORKSPACE' | 'RESTRICTED' = rawVis === 'RESTRICTED' ? 'RESTRICTED' : 'WORKSPACE';
      if (targetWs.isPersonal) {
        normVisibility = 'RESTRICTED';
      }

      // 1. Create project
      const project = await tx.project.create({
        data: {
          name: data.name,
          key: data.key ? data.key.toUpperCase() : undefined,
          description: data.description,
          category: data.category || undefined,
          technologyStack: data.technologyStack || [],
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          endDate: data.endDate ? new Date(data.endDate) : undefined,
          repositoryUrl: data.repositoryUrl || undefined,
          liveUrl: data.liveUrl || undefined,
          avatarUrl: data.avatarUrl || undefined,
          visibility: normVisibility,
          createdById: userId,
          workspaceId: targetWorkspaceId,
        },
      });

      // 2. Add creator as PROJECT_ADMIN
      await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId: userId,
          role: 'PROJECT_ADMIN',
        },
      });

      // 3. Process invitations (if provided)
      const creator = await tx.user.findUnique({
        where: { id: userId },
        select: { email: true, fullName: true, username: true },
      });

      const rawInvitations = data.invitations || (data as any).invitedMembers || [];
      if (rawInvitations && rawInvitations.length > 0) {
        // De-duplicate emails & exclude creator's own email
        const seenEmails = new Set<string>();
        const validInvitations = rawInvitations.filter((inv: any) => {
          const email = inv.email.toLowerCase().trim();
          if (creator && email === creator.email.toLowerCase()) return false;
          if (seenEmails.has(email)) return false;
          seenEmails.add(email);
          return true;
        });

        for (const inv of validInvitations) {
          const normalizedEmail = inv.email.toLowerCase().trim();
          
          // Check if invited user is an active member or owner of targetWorkspaceId
          const existingUser = await tx.user.findUnique({
            where: { email: normalizedEmail },
            select: { id: true, isDeactivated: true },
          });

          let isWsMember = false;
          if (existingUser && !existingUser.isDeactivated) {
            const targetWs = await tx.workspace.findUnique({
              where: { id: targetWorkspaceId },
              select: { ownerId: true },
            });
            if (targetWs?.ownerId === existingUser.id) {
              isWsMember = true;
            } else {
              const wsMember = await tx.workspaceMember.findUnique({
                where: {
                  workspaceId_userId: {
                    workspaceId: targetWorkspaceId,
                    userId: existingUser.id,
                  },
                },
              });
              isWsMember = !!wsMember;
            }
          }

          if (!isWsMember) {
            throw new AppError(`Cannot invite ${normalizedEmail}: user must be an active member of this workspace`, 400);
          }

          // 7-day expiration for invitations
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7);

          await tx.invitation.create({
            data: {
              projectId: project.id,
              invitedEmail: normalizedEmail,
              invitedUserId: existingUser ? existingUser.id : undefined,
              invitedById: userId,
              role: inv.role || 'PROJECT_MEMBER',
              message: inv.message || undefined,
              status: 'PENDING',
              expiresAt,
            },
          });

          // Queue for post-commit dispatch
          pendingEmailDispatches.push({
            email: normalizedEmail,
            role: inv.role || 'PROJECT_MEMBER',
            message: inv.message || null,
            expiresAt,
          });

          // Dispatch in-app notification if invited user is already registered
          if (existingUser) {
            await tx.notification.create({
              data: {
                recipientId: existingUser.id,
                actorId: userId,
                projectId: project.id,
                type: 'PROJECT_INVITED',
                title: 'Project Invitation',
                message: `${creator?.fullName || 'A team member'} invited you to join "${project.name}".`,
                link: '/app/invitations',
              },
            });
          }
        }
      }

      // Create confirmation notification for project creator
      await tx.notification.create({
        data: {
          recipientId: userId,
          projectId: project.id,
          type: 'SYSTEM',
          title: 'Project Created',
          message: `Your project workspace "${project.name}" (${project.key || 'PRJ'}) is ready.`,
          link: `/app/projects/${project.id}`,
        },
      });

      // Return created project with member counts
      const created = await tx.project.findUnique({
        where: { id: project.id },
        include: {
          createdBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          members: {
            include: {
              user: {
                select: { id: true, fullName: true, username: true, avatarUrl: true },
              },
            },
          },
          _count: {
            select: { members: true, invitations: true },
          },
        },
      });

      if (!created) return null;
      return {
        ...created,
        visibility: created.visibility === 'RESTRICTED' ? 'Restricted' : 'Workspace',
      };
    }, { timeout: 20000, maxWait: 10000 });

    // POST-COMMIT: Enqueue invitation emails via BullMQ outside the DB transaction
    if (fullProject && pendingEmailDispatches.length > 0) {
      const inviterName = fullProject.createdBy?.fullName || fullProject.createdBy?.username || 'A team member';
      for (const dispatch of pendingEmailDispatches) {
        try {
          await enqueueEmailJob({
            type: 'PROJECT_INVITATION',
            toEmail: dispatch.email,
            inviterName,
            projectName: fullProject.name,
            projectKey: fullProject.key,
            role: dispatch.role,
            message: dispatch.message,
            expiresAt: dispatch.expiresAt.toISOString(),
          });
        } catch (dispatchErr) {
          console.error(`[ProjectService] Failed to enqueue invitation email to ${dispatch.email}:`, dispatchErr);
        }
      }
    }

    return fullProject;
  }

  /**
   * Helper to verify if a user has access to a project and return project with role/permissions.
   * Enforces:
   * 1. Soft-deleted workspaces are strictly inaccessible (404).
   * 2. Workspace boundary (if workspaceId provided and doesn't match -> 404).
   * 3. Workspace membership is a mandatory prerequisite before project membership grants access (403).
   * 4. Workspace Owner and Admin retain workspace-level access.
   * 5. Personal workspace projects are restricted by default (only explicit project assignment or owner).
   * 6. Team workspace projects: explicit assignment OR WORKSPACE visibility for workspace members.
   */
  async verifyProjectAccess(projectId: string, userId: string, workspaceId?: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            ownerId: true,
            isPersonal: true,
            deletedAt: true,
            members: { where: { userId } },
          },
        },
        members: { where: { userId } },
      },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    if (project.workspace.deletedAt) {
      throw new AppError('The workspace containing this project has been deleted', 404);
    }

    if (workspaceId && project.workspaceId !== workspaceId) {
      throw new AppError('Project not found in the active workspace', 404);
    }

    const isWsOwner = project.workspace.ownerId === userId;
    const wsMember = project.workspace.members[0];
    const isWsMember = !!wsMember;
    const isWsAdmin = wsMember?.role === 'WORKSPACE_ADMIN';
    const projectMember = project.members[0];
    const isProjectMember = !!projectMember;

    const isWsMemberOrOwner = isWsOwner || isWsMember;
    if (!isWsMemberOrOwner) {
      throw new AppError('You are not authorized to view this project', 403);
    }

    let canAccess = false;
    if (isWsOwner || isWsAdmin) {
      canAccess = true;
    } else if (isProjectMember) {
      canAccess = true;
    }

    if (!canAccess) {
      throw new AppError('You are not authorized to view this project', 403);
    }

    const role = (isWsOwner || isWsAdmin)
      ? 'PROJECT_ADMIN'
      : (wsMember?.role === 'PROJECT_ADMIN' || projectMember?.role === 'PROJECT_ADMIN' ? 'PROJECT_ADMIN' : 'PROJECT_MEMBER');
    const isAdmin = role === 'PROJECT_ADMIN';

    return {
      project,
      isWsOwner,
      isWsAdmin,
      isWsMember,
      isProjectMember,
      membership: projectMember,
      role,
      isAdmin,
    };
  }

  /**
   * Helper to retrieve all project IDs accessible by a user within a workspace or globally across workspaces.
   * Strictly enforces:
   * - Soft-deleted workspaces are never accessible.
   * - Workspace membership prerequisite before project membership grants access.
   * - Personal workspace Restricted-project policy.
   * - Team workspace WORKSPACE-visible projects for workspace members.
   * - Workspace Owner/Admin full visibility.
   */
  async getAccessibleProjectIds(userId: string, workspaceId?: string): Promise<string[]> {
    if (workspaceId) {
      const ws = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: { members: { where: { userId } } },
      });
      if (!ws) {
        throw new AppError('Workspace not found', 404);
      }
      if (ws.deletedAt) {
        throw new AppError('The workspace containing this project has been deleted', 404);
      }
      const isWsOwner = ws.ownerId === userId;
      const isWsAdmin = ws.members[0]?.role === 'WORKSPACE_ADMIN';
      const isWsMember = ws.members.length > 0;

      if (!isWsOwner && !isWsAdmin && !isWsMember) {
        throw new AppError('You do not have access to this workspace', 403);
      }

      if (isWsOwner || isWsAdmin) {
        const projects = await prisma.project.findMany({
          where: { workspaceId },
          select: { id: true },
        });
        return projects.map((p) => p.id);
      }

      const projects = await prisma.project.findMany({
        where: {
          workspaceId,
          members: { some: { userId } },
        },
        select: { id: true },
      });
      return projects.map((p) => p.id);
    }

    // Cross-workspace query (no workspaceId filter)
    const adminWorkspaces = await prisma.workspace.findMany({
      where: {
        deletedAt: null,
        OR: [
          { ownerId: userId },
          { members: { some: { userId, role: 'WORKSPACE_ADMIN' } } },
        ],
      },
      select: { id: true },
    });
    const adminWorkspaceIds = adminWorkspaces.map((w) => w.id);

    const projects = await prisma.project.findMany({
      where: {
        workspace: { deletedAt: null },
        OR: [
          { workspaceId: { in: adminWorkspaceIds } },
          {
            members: { some: { userId } },
            workspace: {
              deletedAt: null,
              members: { some: { userId } },
            },
          },
        ],
      },
      select: { id: true },
    });

    return projects.map((p) => p.id);
  }

  /**
   * Get all projects for an authenticated user (categorized into owned and joined)
   */
  async getUserProjects(userId: string, workspaceId?: string) {
    let where: any;
    let isWsOwner = false;
    let isWsAdmin = false;

    if (workspaceId) {
      const ws = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: { members: { where: { userId } } },
      });
      if (!ws || ws.deletedAt) {
        return { all: [], owned: [], joined: [] };
      }
      isWsOwner = ws.ownerId === userId;
      isWsAdmin = ws.members[0]?.role === 'WORKSPACE_ADMIN';
      const isWsMember = ws.members.length > 0;

      if (!isWsOwner && !isWsAdmin && !isWsMember) {
        return { all: [], owned: [], joined: [] };
      }

      if (isWsOwner || isWsAdmin) {
        where = { workspaceId, workspace: { deletedAt: null } };
      } else {
        where = {
          workspaceId,
          workspace: { deletedAt: null },
          members: { some: { userId } },
        };
      }
    } else {
      const adminWorkspaces = await prisma.workspace.findMany({
        where: {
          deletedAt: null,
          OR: [
            { ownerId: userId },
            { members: { some: { userId, role: 'WORKSPACE_ADMIN' } } },
          ],
        },
        select: { id: true },
      });
      const adminWorkspaceIds = adminWorkspaces.map((w) => w.id);

      where = {
        workspace: { deletedAt: null },
        OR: [
          { workspaceId: { in: adminWorkspaceIds } },
          {
            members: { some: { userId } },
            workspace: {
              deletedAt: null,
              members: { some: { userId } },
            },
          },
        ],
      };
    }

    // Projects where user is a member or workspace admin/owner in this workspace
    const projects = await prisma.project.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, fullName: true, username: true, avatarUrl: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, fullName: true, username: true, avatarUrl: true },
            },
          },
        },
        _count: {
          select: { members: true, workItems: true },
        },
        workItems: {
          select: { id: true, status: true },
        },
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            isPersonal: true,
            ownerId: true,
            members: { where: { userId } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const formatted = projects.map((p) => {
      const userMember = p.members.find((m) => m.userId === userId);
      const projectIsWsOwner = isWsOwner || p.workspace?.ownerId === userId;
      const projectIsWsAdmin = isWsAdmin || p.workspace?.members[0]?.role === 'WORKSPACE_ADMIN';
      const userRole = (projectIsWsOwner || projectIsWsAdmin)
        ? 'PROJECT_ADMIN'
        : (userMember ? userMember.role : 'PROJECT_MEMBER');
      const totalTasks = p.workItems ? p.workItems.length : (p._count as any)?.workItems || 0;
      const completedTasks = p.workItems ? p.workItems.filter((w) => w.status === 'COMPLETED').length : 0;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      const visibility = p.visibility === 'RESTRICTED' ? 'Restricted' : 'Workspace';

      return {
        id: p.id,
        name: p.name,
        key: p.key,
        description: p.description,
        category: p.category,
        technologyStack: p.technologyStack,
        startDate: p.startDate,
        endDate: p.endDate,
        repositoryUrl: p.repositoryUrl,
        liveUrl: p.liveUrl,
        avatarUrl: p.avatarUrl,
        status: p.status,
        workspaceId: p.workspaceId,
        workspace: p.workspace,
        createdById: p.createdById,
        createdBy: p.createdBy,
        userRole,
        visibility,
        taskCount: totalTasks,
        completedTaskCount: completedTasks,
        progress,
        memberCount: p._count.members,
        members: p.members.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt,
          user: m.user,
        })),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    });

    const owned = formatted.filter((p) => p.userRole === 'PROJECT_ADMIN');
    const joined = formatted.filter((p) => p.userRole !== 'PROJECT_ADMIN');

    return {
      all: formatted,
      owned,
      joined,
    };
  }

  /**
   * Get project details with authorization check and workspace validation
   */
  async getProjectById(projectId: string, userId: string, workspaceId?: string) {
    const { role, isAdmin } = await this.verifyProjectAccess(projectId, userId, workspaceId);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        createdBy: {
          select: { id: true, fullName: true, username: true, avatarUrl: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, fullName: true, username: true, avatarUrl: true, email: true },
            },
          },
        },
        invitations: {
          where: { status: 'PENDING' },
          include: {
            invitedBy: {
              select: { id: true, fullName: true, username: true },
            },
          },
        },
      },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const visibility = project.visibility === 'RESTRICTED' ? 'Restricted' : 'Workspace';

    return {
      ...project,
      userRole: role,
      visibility,
      // Only project admins see pending invitations
      invitations: isAdmin ? project.invitations : [],
    };
  }

  /**
   * Update project details (Project Admin only)
   */
  async updateProject(projectId: string, userId: string, data: UpdateProjectInput) {
    const { project, isAdmin } = await this.verifyProjectAccess(projectId, userId);

    if (!isAdmin) {
      throw new AppError('Only project administrators can update project details', 403);
    }

    let normVisibility: 'WORKSPACE' | 'RESTRICTED' | undefined = undefined;
    if (data.visibility !== undefined) {
      const rawVis = String(data.visibility).toUpperCase();
      normVisibility = rawVis === 'RESTRICTED' ? 'RESTRICTED' : 'WORKSPACE';
      if (project.workspace.isPersonal && normVisibility === 'WORKSPACE') {
        throw new AppError('Projects in a personal workspace cannot be made workspace-visible', 400);
      }
    }

    return await prisma.$transaction(async (tx) => {
      const freshWs = await tx.workspace.findUnique({
        where: { id: project.workspaceId },
        select: { deletedAt: true },
      });
      if (!freshWs || freshWs.deletedAt) {
        throw new AppError('Project not found', 404);
      }

      const updated = await tx.project.update({
        where: { id: projectId },
        data: {
          name: data.name !== undefined ? data.name : undefined,
          key: data.key !== undefined ? (data.key ? data.key.toUpperCase() : null) : undefined,
          description: data.description !== undefined ? data.description : undefined,
          category: data.category !== undefined ? data.category : undefined,
          technologyStack: data.technologyStack !== undefined ? data.technologyStack : undefined,
          startDate: data.startDate !== undefined ? (data.startDate ? new Date(data.startDate) : null) : undefined,
          endDate: data.endDate !== undefined ? (data.endDate ? new Date(data.endDate) : null) : undefined,
          repositoryUrl: data.repositoryUrl !== undefined ? data.repositoryUrl : undefined,
          liveUrl: data.liveUrl !== undefined ? data.liveUrl : undefined,
          avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : undefined,
          visibility: normVisibility,
        },
        include: {
          createdBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          members: {
            include: {
              user: {
                select: { id: true, fullName: true, username: true, avatarUrl: true },
              },
            },
          },
        },
      });

      return {
        ...updated,
        visibility: updated.visibility === 'RESTRICTED' ? 'Restricted' : 'Workspace',
      };
    });
  }

  /**
   * Archive project (Workspace Owner or authorized Workspace Admin only)
   */
  async archiveProject(projectId: string, userId: string) {
    const { project, isWsOwner, isWsAdmin } = await this.verifyProjectAccess(projectId, userId);

    const ws = await prisma.workspace.findUnique({
      where: { id: project.workspaceId },
      select: { isPersonal: true, adminPermissions: true, deletedAt: true },
    });
    if (!ws || ws.deletedAt) {
      throw new AppError('Workspace not found', 404);
    }
    const perms = resolveFullWorkspacePermissions(ws);

    if (isWsOwner) {
      // Owner can always archive
    } else if (isWsAdmin) {
      if (!perms.workspaceAdmin.canArchiveProjects) {
        throw new AppError('Workspace administrator does not have permission to archive projects in this workspace', 403);
      }
    } else {
      throw new AppError('Only workspace owners and authorized workspace administrators can archive projects', 403);
    }

    if (project.status === 'ARCHIVED') {
      return project;
    }

    return await prisma.$transaction(async (tx) => {
      const freshWs = await tx.workspace.findUnique({
        where: { id: project.workspaceId },
        select: { deletedAt: true },
      });
      if (!freshWs || freshWs.deletedAt) {
        throw new AppError('Project not found', 404);
      }

      const updated = await tx.project.update({
        where: { id: projectId },
        data: {
          status: 'ARCHIVED',
          archivedAt: new Date(),
        },
        include: {
          createdBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
        },
      });

      return updated;
    });
  }

  /**
   * Unarchive project (Workspace Owner or authorized Workspace Admin only)
   */
  async unarchiveProject(projectId: string, userId: string) {
    const { project, isWsOwner, isWsAdmin } = await this.verifyProjectAccess(projectId, userId);

    const ws = await prisma.workspace.findUnique({
      where: { id: project.workspaceId },
      select: { isPersonal: true, adminPermissions: true, deletedAt: true },
    });
    if (!ws || ws.deletedAt) {
      throw new AppError('Workspace not found', 404);
    }
    const perms = resolveFullWorkspacePermissions(ws);

    if (isWsOwner) {
      // Owner can always unarchive
    } else if (isWsAdmin) {
      if (!perms.workspaceAdmin.canArchiveProjects) {
        throw new AppError('Workspace administrator does not have permission to unarchive projects in this workspace', 403);
      }
    } else {
      throw new AppError('Only workspace owners and authorized workspace administrators can unarchive projects', 403);
    }

    return await prisma.$transaction(async (tx) => {
      const freshWs = await tx.workspace.findUnique({
        where: { id: project.workspaceId },
        select: { deletedAt: true },
      });
      if (!freshWs || freshWs.deletedAt) {
        throw new AppError('Project not found', 404);
      }

      const updated = await tx.project.update({
        where: { id: projectId },
        data: {
          status: 'ACTIVE',
          archivedAt: null,
        },
        include: {
          createdBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
        },
      });

      return updated;
    });
  }

  /**
   * Delete project (Project Admin or Workspace Owner/Admin only)
   */
  async deleteProject(projectId: string, userId: string, confirmProjectName?: string) {
    const { project, isAdmin } = await this.verifyProjectAccess(projectId, userId);

    if (!isAdmin) {
      throw new AppError('Only project administrators can delete this project', 403);
    }

    if (confirmProjectName !== undefined && confirmProjectName !== project.name) {
      throw new AppError(`Project name does not match. Please enter "${project.name}" to confirm permanent deletion.`, 400);
    }

    // Ensure durable storage cleanup outbox table exists in database (Item 5)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_storage_cleanup_outbox" (
        id TEXT PRIMARY KEY,
        "storageKey" TEXT NOT NULL,
        "projectId" TEXT NOT NULL,
        attempts INT DEFAULT 0,
        status TEXT DEFAULT 'PENDING',
        error TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 1. Collect physical keys and create durable outbox records transactionally with project deletion
    const outboxItems = await prisma.$transaction(async (tx) => {
      const freshWs = await tx.workspace.findUnique({
        where: { id: project.workspaceId },
        select: { deletedAt: true },
      });
      if (!freshWs || freshWs.deletedAt) {
        throw new AppError('Project not found', 404);
      }

      const storedObjects = await tx.storedObject.findMany({
        where: { projectId },
        select: { storageKey: true },
      });

      const attachments = await tx.attachment.findMany({
        where: { projectId },
        select: { storageKey: true },
      });

      const allKeys = Array.from(new Set([
        ...storedObjects.map((s) => s.storageKey),
        ...attachments.map((a) => a.storageKey),
      ])).filter(Boolean);

      const items: { id: string; storageKey: string }[] = [];
      for (const storageKey of allKeys) {
        const outboxId = crypto.randomUUID();
        await tx.$executeRawUnsafe(
          `INSERT INTO "_storage_cleanup_outbox" (id, "storageKey", "projectId", status, attempts) VALUES ($1, $2, $3, 'PENDING', 0)`,
          outboxId,
          storageKey,
          projectId
        );
        items.push({ id: outboxId, storageKey });
      }

      await tx.project.delete({
        where: { id: projectId },
      });

      return items;
    });

    // 2. Dispatch BullMQ cleanup jobs with outbox tracking
    for (const item of outboxItems) {
      try {
        await enqueueCleanupJob({
          type: 'ORPHAN_STORAGE_CLEANUP',
          storageKey: item.storageKey,
          outboxId: item.id,
        });
      } catch (enqueueErr) {
        console.warn(`[ProjectService] BullMQ enqueue failed for outbox task ${item.id}. Task remains safely in outbox table:`, enqueueErr);
      }
    }

    return { id: projectId, name: project.name };
  }

  /**
   * Transfer project ownership from current creator to another project member
   */
  async transferOwnership(projectId: string, currentUserId: string, targetUserId: string) {
    const { project } = await this.verifyProjectAccess(projectId, currentUserId);

    if (project.createdById !== currentUserId) {
      throw new AppError('Only the current project owner can transfer ownership', 403);
    }

    if (currentUserId === targetUserId) {
      throw new AppError('You are already the owner of this project', 400);
    }

    const targetProject = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: { where: { userId: targetUserId } },
      },
    });

    const targetMember = targetProject?.members[0];
    if (!targetMember) {
      throw new AppError('The new owner must be an existing member of the project', 400);
    }

    return await prisma.$transaction(async (tx) => {
      const freshWs = await tx.workspace.findUnique({
        where: { id: project.workspaceId },
        select: { deletedAt: true },
      });
      if (!freshWs || freshWs.deletedAt) {
        throw new AppError('Project not found', 404);
      }

      // Ensure the new owner is a PROJECT_ADMIN
      await tx.projectMember.update({
        where: { id: targetMember.id },
        data: { role: 'PROJECT_ADMIN' },
      });

      const updatedProject = await tx.project.update({
        where: { id: projectId },
        data: { createdById: targetUserId },
      });

      return updatedProject;
    });
  }

  /**
   * Complete project or submit completion request:
   * - Workspace Owner / Workspace Admin: directly sets status to COMPLETED (approves any pending request).
   * - Project Admin: creates/updates a completion request awaiting Workspace Owner/Admin approval.
   */
  async completeProject(projectId: string, userId: string, reason?: string, explicitWorkspaceId?: string) {
    const { project, isWsOwner, isWsAdmin, isAdmin } = await this.verifyProjectAccess(projectId, userId, explicitWorkspaceId);

    if (project.status === 'COMPLETED') {
      return { project, completed: true, alreadyCompleted: true, message: 'Project is already marked as completed' };
    }

    const ws = await prisma.workspace.findUnique({
      where: { id: project.workspaceId },
      include: {
        members: { where: { role: 'WORKSPACE_ADMIN' }, select: { userId: true } },
      },
    });
    if (!ws || ws.deletedAt) {
      throw new AppError('Workspace not found', 404);
    }

    const perms = resolveFullWorkspacePermissions(ws);
    const canWsAdminDirectlyComplete = perms.workspaceAdmin.canDirectlyCompleteProject !== false;

    const canDirectlyComplete = isWsOwner || (isWsAdmin && canWsAdminDirectlyComplete);

    if (canDirectlyComplete) {
      // Direct completion by Workspace Owner or Workspace Admin
      const updated = await prisma.$transaction(async (tx) => {
        const p = await tx.project.update({
          where: { id: projectId },
          data: {
            status: 'COMPLETED',
          },
          include: {
            createdBy: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
            members: { include: { user: { select: { id: true, fullName: true, username: true, avatarUrl: true } } } },
          },
        });

        // Also update any pending completion request in adminPermissions
        const rawPerms = (ws.adminPermissions as any) || {};
        const requests = Array.isArray(rawPerms.projectCompletionRequests) ? rawPerms.projectCompletionRequests : [];
        let updatedRequests = false;
        const newRequests = requests.map((r: any) => {
          if (r.projectId === projectId && r.status === 'PENDING') {
            updatedRequests = true;
            return {
              ...r,
              status: 'APPROVED',
              reviewedById: userId,
              reviewedAt: new Date().toISOString(),
            };
          }
          return r;
        });

        if (updatedRequests) {
          await tx.workspace.update({
            where: { id: ws.id },
            data: {
              adminPermissions: {
                ...rawPerms,
                projectCompletionRequests: newRequests,
              },
            },
          });
        }

        // Create project activity
        await tx.activity.create({
          data: {
            projectId,
            actorId: userId,
            type: 'WORK_COMPLETED',
          },
        });

        return p;
      });

      return {
        project: updated,
        completed: true,
        message: 'Project marked as completed successfully',
      };
    }

    if (isWsAdmin || isAdmin) {
      // Workspace Admin without direct complete rights OR Project Admin -> Create Completion Request
      const requester = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, fullName: true, username: true, email: true, avatarUrl: true },
      });

      const rawPerms = (ws.adminPermissions as any) || {};
      const requests = Array.isArray(rawPerms.projectCompletionRequests) ? rawPerms.projectCompletionRequests : [];

      // Check if there is already a pending request
      const existingPending = requests.find((r: any) => r.projectId === projectId && r.status === 'PENDING');
      if (existingPending) {
        return {
          project,
          requestSubmitted: true,
          request: existingPending,
          message: 'A completion request for this project is already pending review',
        };
      }

      const requesterRole = isWsAdmin ? 'WORKSPACE_ADMIN' : 'PROJECT_ADMIN';

      const newRequest = {
        id: crypto.randomUUID(),
        projectId: project.id,
        projectName: project.name,
        projectKey: project.key || '',
        requestedById: userId,
        requesterRole,
        requestedByName: requester?.fullName || requester?.username || (isWsAdmin ? 'Workspace Admin' : 'Project Admin'),
        requestedByEmail: requester?.email || '',
        requestedByAvatar: requester?.avatarUrl || null,
        reason: reason?.trim() || null,
        requestedAt: new Date().toISOString(),
        status: 'PENDING',
      };

      const updatedRequests = [...requests, newRequest];

      await prisma.workspace.update({
        where: { id: ws.id },
        data: {
          adminPermissions: {
            ...perms,
            projectCompletionRequests: updatedRequests,
          },
        },
      });

      // Dispatch notifications to Workspace Owner and all Workspace Admins
      const targetUserIds = new Set<string>();
      if (ws.ownerId && ws.ownerId !== userId) {
        targetUserIds.add(ws.ownerId);
      }
      for (const m of ws.members) {
        if (m.userId !== userId) {
          targetUserIds.add(m.userId);
        }
      }

      for (const adminId of targetUserIds) {
        await prisma.notification.create({
          data: {
            recipientId: adminId,
            actorId: userId,
            projectId: project.id,
            type: 'SYSTEM',
            title: 'Project Completion Requested',
            message: `${newRequest.requestedByName} requested to mark "${project.name}" as completed.`,
            link: `/app/projects/${project.id}`,
          },
        }).catch(() => {});
      }

      return {
        project,
        requestSubmitted: true,
        request: newRequest,
        message: 'Completion request submitted to workspace administrators',
      };
    }

    throw new AppError('Only project administrators or workspace administrators can mark a project as complete', 403);
  }

  /**
   * Reactivate a completed project back to ACTIVE (Workspace Owner/Admin or Project Admin)
   */
  async reactivateProject(projectId: string, userId: string, explicitWorkspaceId?: string) {
    const { project, isAdmin, isWsOwner, isWsAdmin } = await this.verifyProjectAccess(projectId, userId, explicitWorkspaceId);

    if (!isAdmin && !isWsOwner && !isWsAdmin) {
      throw new AppError('Only administrators can reactivate this project', 403);
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'ACTIVE',
      },
      include: {
        createdBy: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        members: { include: { user: { select: { id: true, fullName: true, username: true, avatarUrl: true } } } },
      },
    });

    return {
      project: updated,
      reactivated: true,
      message: 'Project reactivated successfully',
    };
  }

  /**
   * Get completion status and any pending completion request for a project
   */
  async getCompletionStatus(projectId: string, userId: string, explicitWorkspaceId?: string) {
    const { project, isWsOwner, isWsAdmin, isAdmin } = await this.verifyProjectAccess(projectId, userId, explicitWorkspaceId);

    const ws = await prisma.workspace.findUnique({
      where: { id: project.workspaceId },
      select: { adminPermissions: true },
    });

    const perms = (ws?.adminPermissions as any) || {};
    const requests = Array.isArray(perms.projectCompletionRequests) ? perms.projectCompletionRequests : [];
    const pendingRequest = requests.find((r: any) => r.projectId === projectId && r.status === 'PENDING') || null;

    return {
      status: project.status,
      pendingRequest,
      canDirectlyComplete: isWsOwner || isWsAdmin,
      canRequestComplete: isAdmin,
      isWsOwnerOrAdmin: isWsOwner || isWsAdmin,
    };
  }

  /**
   * Get all completion requests in a workspace (Workspace Owner, Workspace Admin, or Project Admins)
   */
  async getWorkspaceCompletionRequests(workspaceId: string, userId: string) {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { members: { where: { userId } } },
    });
    if (!ws || ws.deletedAt) throw new AppError('Workspace not found', 404);

    const isWsOwner = ws.ownerId === userId;
    const isWsAdmin = ws.members[0]?.role === 'WORKSPACE_ADMIN';
    const isWsMember = ws.members.length > 0;

    if (!isWsOwner && !isWsAdmin && !isWsMember) {
      throw new AppError('You do not have access to this workspace', 403);
    }

    const perms = (ws.adminPermissions as any) || {};
    const requests = Array.isArray(perms.projectCompletionRequests) ? perms.projectCompletionRequests : [];

    return {
      requests: requests.filter((r: any) => r.status === 'PENDING'),
      allRequests: requests,
    };
  }

  /**
   * Approve a project completion request (Workspace Owner or Workspace Admin)
   */
  async approveCompletionRequest(workspaceId: string, requestId: string, userId: string) {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { members: { where: { userId } } },
    });
    if (!ws || ws.deletedAt) throw new AppError('Workspace not found', 404);

    const isWsOwner = ws.ownerId === userId;
    const isWsAdmin = ws.members[0]?.role === 'WORKSPACE_ADMIN';
    const permissions = resolveFullWorkspacePermissions(ws);
    const canWsAdminDirectlyComplete = permissions.workspaceAdmin.canDirectlyCompleteProject !== false;

    if (!isWsOwner && (!isWsAdmin || !canWsAdminDirectlyComplete)) {
      throw new AppError('Only workspace owners or authorized workspace administrators can approve project completion requests', 403);
    }

    const perms = (ws.adminPermissions as any) || {};
    const requests = Array.isArray(perms.projectCompletionRequests) ? perms.projectCompletionRequests : [];
    const targetReq = requests.find((r: any) => r.id === requestId);

    if (!targetReq) {
      throw new AppError('Completion request not found', 404);
    }

    if (targetReq.requesterRole === 'WORKSPACE_ADMIN' && !isWsOwner) {
      throw new AppError('Only the workspace owner can approve completion requests submitted by workspace administrators', 403);
    }

    // Update project status to COMPLETED
    await prisma.project.update({
      where: { id: targetReq.projectId },
      data: { status: 'COMPLETED' },
    });

    const updatedRequests = requests.map((r: any) => {
      if (r.id === requestId) {
        return {
          ...r,
          status: 'APPROVED',
          reviewedById: userId,
          reviewedAt: new Date().toISOString(),
        };
      }
      return r;
    });

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        adminPermissions: {
          ...perms,
          projectCompletionRequests: updatedRequests,
        },
      },
    });

    // Notify requester
    if (targetReq.requestedById) {
      await prisma.notification.create({
        data: {
          recipientId: targetReq.requestedById,
          actorId: userId,
          projectId: targetReq.projectId,
          type: 'SYSTEM',
          title: 'Project Completion Approved',
          message: `Your request to mark "${targetReq.projectName}" as completed was approved.`,
          link: `/app/projects/${targetReq.projectId}`,
        },
      }).catch(() => {});
    }

    return {
      success: true,
      projectId: targetReq.projectId,
      message: `Project "${targetReq.projectName}" approved and marked as completed`,
    };
  }

  /**
   * Reject a project completion request (Workspace Owner or Workspace Admin)
   * Project stays ACTIVE.
   */
  async rejectCompletionRequest(workspaceId: string, requestId: string, userId: string, reviewNote?: string) {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { members: { where: { userId } } },
    });
    if (!ws || ws.deletedAt) throw new AppError('Workspace not found', 404);

    const isWsOwner = ws.ownerId === userId;
    const isWsAdmin = ws.members[0]?.role === 'WORKSPACE_ADMIN';

    if (!isWsOwner && !isWsAdmin) {
      throw new AppError('Only workspace administrators can reject project completion requests', 403);
    }

    const perms = (ws.adminPermissions as any) || {};
    const requests = Array.isArray(perms.projectCompletionRequests) ? perms.projectCompletionRequests : [];
    const targetReq = requests.find((r: any) => r.id === requestId);

    if (!targetReq) {
      throw new AppError('Completion request not found', 404);
    }

    const updatedRequests = requests.map((r: any) => {
      if (r.id === requestId) {
        return {
          ...r,
          status: 'REJECTED',
          reviewedById: userId,
          reviewedAt: new Date().toISOString(),
          reviewNote: reviewNote || null,
        };
      }
      return r;
    });

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        adminPermissions: {
          ...perms,
          projectCompletionRequests: updatedRequests,
        },
      },
    });

    // Notify requester
    if (targetReq.requestedById) {
      await prisma.notification.create({
        data: {
          recipientId: targetReq.requestedById,
          actorId: userId,
          projectId: targetReq.projectId,
          type: 'SYSTEM',
          title: 'Project Completion Declined',
          message: `Your request to mark "${targetReq.projectName}" as completed was declined. Project remains active.${reviewNote ? ` Note: "${reviewNote}"` : ''}`,
          link: `/app/projects/${targetReq.projectId}`,
        },
      }).catch(() => {});
    }

    return {
      success: true,
      projectId: targetReq.projectId,
      message: `Completion request for "${targetReq.projectName}" was declined. Project remains active.`,
    };
  }

  /**
   * Cancel a pending project completion request (Requester or Admin)
   */
  async cancelCompletionRequest(workspaceId: string, requestId: string, userId: string) {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { members: { where: { userId } } },
    });
    if (!ws || ws.deletedAt) throw new AppError('Workspace not found', 404);

    const isWsOwner = ws.ownerId === userId;
    const isWsAdmin = ws.members[0]?.role === 'WORKSPACE_ADMIN';

    const perms = (ws.adminPermissions as any) || {};
    const requests = Array.isArray(perms.projectCompletionRequests) ? perms.projectCompletionRequests : [];
    const targetReq = requests.find((r: any) => r.id === requestId);

    if (!targetReq) {
      throw new AppError('Completion request not found', 404);
    }

    if (!isWsOwner && !isWsAdmin && targetReq.requestedById !== userId) {
      throw new AppError('You are not authorized to cancel this completion request', 403);
    }

    const updatedRequests = requests.filter((r: any) => r.id !== requestId);

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        adminPermissions: {
          ...perms,
          projectCompletionRequests: updatedRequests,
        },
      },
    });

    return {
      success: true,
      message: 'Completion request cancelled successfully',
    };
  }
}

export const projectService = new ProjectService();
