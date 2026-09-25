import crypto from 'node:crypto';
import { prisma } from '../prisma.js';
import { CreateProjectInput, UpdateProjectInput } from '../schemas/project.schema.js';
import { AppError } from '../middlewares/error.middleware.js';
import { enqueueEmailJob, enqueueCleanupJob } from '../jobs/queues.js';

export class ProjectService {
  /**
   * Atomic project creation transaction:
   * 1. Create Project
   * 2. Create ProjectMember for creator as PROJECT_ADMIN
   * 3. Create pending invitations (if any)
   * 4. Post-commit: Enqueue invitation emails via BullMQ
   */
  async createProject(userId: string, data: CreateProjectInput) {
    const pendingEmailDispatches: Array<{
      email: string;
      role: string;
      message: string | null;
      expiresAt: Date;
    }> = [];

    const fullProject = await prisma.$transaction(async (tx) => {
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
          createdById: userId,
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
          
          // Check if invited user is already a registered D-Board user
          const existingUser = await tx.user.findUnique({
            where: { email: normalizedEmail },
            select: { id: true },
          });

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

      return created;
    });

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
   * Get all projects for an authenticated user (categorized into owned and joined)
   */
  async getUserProjects(userId: string) {
    // Projects where user is a member or creator
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { createdById: userId },
          { members: { some: { userId } } },
        ],
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
        _count: {
          select: { members: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const formatted = projects.map((p) => {
      const userMember = p.members.find((m) => m.userId === userId);
      const isOwner = p.createdById === userId || userMember?.role === 'PROJECT_ADMIN';
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
        createdById: p.createdById,
        createdBy: p.createdBy,
        userRole: userMember ? userMember.role : isOwner ? 'PROJECT_ADMIN' : 'PROJECT_MEMBER',
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

    const owned = formatted.filter((p) => p.createdById === userId || p.userRole === 'PROJECT_ADMIN');
    const joined = formatted.filter((p) => p.createdById !== userId && p.userRole !== 'PROJECT_ADMIN');

    return {
      all: formatted,
      owned,
      joined,
    };
  }

  /**
   * Get project details with authorization check
   */
  async getProjectById(projectId: string, userId: string) {
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

    const membership = project.members.find((m) => m.userId === userId);
    const isCreator = project.createdById === userId;

    if (!membership && !isCreator) {
      throw new AppError('You are not authorized to view this project', 403);
    }

    const userRole = membership ? membership.role : isCreator ? 'PROJECT_ADMIN' : 'PROJECT_MEMBER';
    const isAdmin = userRole === 'PROJECT_ADMIN';

    return {
      ...project,
      userRole,
      // Only project admins see pending invitations
      invitations: isAdmin ? project.invitations : [],
    };
  }

  /**
   * Update project details (Project Admin only)
   */
  async updateProject(projectId: string, userId: string, data: UpdateProjectInput) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const member = project.members.find((m) => m.userId === userId);
    const isCreator = project.createdById === userId;

    if (!isCreator && member?.role !== 'PROJECT_ADMIN') {
      throw new AppError('Only project administrators can update project details', 403);
    }

    const updated = await prisma.project.update({
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

    return updated;
  }

  /**
   * Archive project (Project Admin or Creator only)
   */
  async archiveProject(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const isCreator = project.createdById === userId;
    const member = project.members.find((m) => m.userId === userId);
    const isAdmin = isCreator || member?.role === 'PROJECT_ADMIN';

    if (!isAdmin) {
      throw new AppError('Only project administrators can archive this project', 403);
    }

    if (project.status === 'ARCHIVED') {
      return project;
    }

    const updated = await prisma.project.update({
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
  }

  /**
   * Unarchive project (Project Admin or Creator only)
   */
  async unarchiveProject(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const isCreator = project.createdById === userId;
    const member = project.members.find((m) => m.userId === userId);
    const isAdmin = isCreator || member?.role === 'PROJECT_ADMIN';

    if (!isAdmin) {
      throw new AppError('Only project administrators can unarchive this project', 403);
    }

    const updated = await prisma.project.update({
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
  }

  /**
   * Delete project (Project Admin or Creator only, requires exact project name confirmation if provided)
   */
  async deleteProject(projectId: string, userId: string, confirmProjectName?: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const isCreator = project.createdById === userId;
    const member = project.members.find((m) => m.userId === userId);
    const isAdmin = isCreator || member?.role === 'PROJECT_ADMIN';

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
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: { where: { userId: targetUserId } },
      },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    if (project.createdById !== currentUserId) {
      throw new AppError('Only the current project owner can transfer ownership', 403);
    }

    if (currentUserId === targetUserId) {
      throw new AppError('You are already the owner of this project', 400);
    }

    const targetMember = project.members[0];
    if (!targetMember) {
      throw new AppError('The new owner must be an existing member of the project', 400);
    }

    return await prisma.$transaction(async (tx) => {
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
}

export const projectService = new ProjectService();
