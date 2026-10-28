import { prisma } from '../prisma.js';
import { CreateWorkItemInput, UpdateWorkItemInput, ReviewTaskInput } from '../schemas/work.schema.js';
import { activityService } from './activity.service.js';
import { notificationService } from './notification.service.js';
import { AppError } from '../middlewares/error.middleware.js';
import { publishToProject } from '../realtime/realtime.service.js';
import { scheduleWorkItemDeadlines, cancelDeadlineJobs } from '../jobs/queues.js';
import { cacheService } from '../redis/cache.service.js';
import { projectService } from './project.service.js';

export class WorkService {
  /**
   * Helper to verify project membership
   */
  private async verifyProjectMember(projectId: string, userId: string) {
    const access = await projectService.verifyProjectAccess(projectId, userId);
    return { project: access.project, role: access.role, isAdmin: access.isAdmin };
  }

  /**
   * Helper to verify that an assigned user belongs to the project
   */
  private async verifyAssigneeInProject(projectId: string, assignedToId: string) {
    try {
      await projectService.verifyProjectAccess(projectId, assignedToId);
    } catch {
      throw new AppError('The assigned user is not a member of this project', 400);
    }
  }

  /**
   * Create a new work item and log activity
   */
  async createWorkItem(projectId: string, userId: string, data: CreateWorkItemInput) {
    const { project } = await this.verifyProjectMember(projectId, userId);

    if (project.status === 'ARCHIVED') {
      throw new AppError('Cannot create work items in an archived project', 400);
    }

    const rawAssigneeIds = data.assigneeIds || (data.assignedToId ? [data.assignedToId] : []);
    const assigneeIds = Array.from(new Set(rawAssigneeIds.map((id) => id.trim()).filter(Boolean)));
    const assignedToId = assigneeIds.length > 0 ? assigneeIds[0] : (data.assignedToId && data.assignedToId.trim() ? data.assignedToId.trim() : null);

    for (const aId of assigneeIds) {
      await this.verifyAssigneeInProject(projectId, aId);
    }

    const access = await projectService.verifyProjectAccess(projectId, userId);
    const isOwnerOrAdmin = access.isWsOwner || access.isWsAdmin || access.isAdmin;

    // Rule: Project members cannot assign tasks to Workspace Owner or Workspace Admin
    if (!isOwnerOrAdmin && assigneeIds.length > 0) {
      const restrictedMembers = await prisma.workspaceMember.findMany({
        where: {
          workspaceId: project.workspaceId,
          OR: [{ role: 'WORKSPACE_ADMIN' }, { role: 'OWNER' }],
        },
        select: { userId: true },
      });
      const restrictedUserIds = new Set(restrictedMembers.map((m) => m.userId));
      if (project.workspace?.ownerId) {
        restrictedUserIds.add(project.workspace.ownerId);
      }

      for (const aId of assigneeIds) {
        if (restrictedUserIds.has(aId)) {
          throw new AppError('Project members cannot assign tasks to Workspace Owners or Workspace Administrators', 403);
        }
      }
    }

    // Validation: 4 sequential stage due dates (today <= todo <= inProgress <= inReview <= completed)
    if (data.todoDueDate && data.inProgressDueDate && data.inReviewDueDate && (data.completedDueDate || data.dueDate)) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todoDate = new Date(data.todoDueDate);
      const inProgressDate = new Date(data.inProgressDueDate);
      const inReviewDate = new Date(data.inReviewDueDate);
      const completedDate = new Date(data.completedDueDate || data.dueDate!);

      if (todoDate < today) {
        throw new AppError('To Do due date cannot be before today', 400);
      }
      if (inProgressDate < todoDate) {
        throw new AppError('In Progress due date cannot be before To Do due date', 400);
      }
      if (inReviewDate < inProgressDate) {
        throw new AppError('In Review due date cannot be before In Progress due date', 400);
      }
      if (completedDate < inReviewDate) {
        throw new AppError('Completed due date cannot be before In Review due date', 400);
      }
    }

    const createdItem = await prisma.$transaction(async (tx) => {
      const isCompleted = data.status === 'COMPLETED';

      const workItem = await tx.workItem.create({
        data: {
          projectId,
          title: data.title.trim(),
          description: data.description ? data.description.trim() : null,
          type: data.type || 'TASK',
          status: data.status || 'TODO',
          priority: data.priority || 'MEDIUM',
          createdById: userId,
          assignedToId,
          dueDate: data.completedDueDate ? new Date(data.completedDueDate) : (data.dueDate ? new Date(data.dueDate) : null),
          todoDueDate: data.todoDueDate ? new Date(data.todoDueDate) : null,
          inProgressDueDate: data.inProgressDueDate ? new Date(data.inProgressDueDate) : null,
          inReviewDueDate: data.inReviewDueDate ? new Date(data.inReviewDueDate) : null,
          completedDueDate: data.completedDueDate ? new Date(data.completedDueDate) : (data.dueDate ? new Date(data.dueDate) : null),
          completedAt: isCompleted ? new Date() : null,
          assignees: assigneeIds.length > 0 ? {
            create: assigneeIds.map((uId) => ({ userId: uId })),
          } : undefined,
        },
        include: {
          createdBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          assignedTo: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          assignees: {
            include: {
              user: {
                select: { id: true, fullName: true, username: true, avatarUrl: true },
              },
            },
          },
        },
      });

      // Log WORK_CREATED activity
      await activityService.createActivity(
        {
          projectId,
          actorId: userId,
          type: 'WORK_CREATED',
          workItemId: workItem.id,
          metadata: {
            title: workItem.title,
            type: workItem.type,
            status: workItem.status,
            priority: workItem.priority,
          },
        },
        tx
      );

      // Log WORK_ASSIGNED activity and notifications for all assignees
      if (assigneeIds.length > 0) {
        await activityService.createActivity(
          {
            projectId,
            actorId: userId,
            type: 'WORK_ASSIGNED',
            workItemId: workItem.id,
            metadata: {
              assignedToId,
              assigneeIds,
              assignedToName: workItem.assignedTo?.fullName || workItem.assignedTo?.username,
            },
          },
          tx
        );

        for (const aId of assigneeIds) {
          if (aId !== userId) {
            await notificationService.createNotification(
              {
                recipientId: aId,
                actorId: userId,
                projectId,
                workItemId: workItem.id,
                type: 'WORK_ASSIGNED',
                title: 'Work item assigned to you',
                message: `${workItem.createdBy?.fullName || workItem.createdBy?.username || 'Someone'} assigned you to "${workItem.title}"`,
                link: `/app/projects/${projectId}/board?item=${workItem.id}`,
              },
              tx
            );
          }
        }
      }

      return workItem;
    });

    publishToProject(projectId, 'WORK_CREATED', {
      projectId,
      workItemId: createdItem.id,
      title: createdItem.title,
      status: createdItem.status,
      priority: createdItem.priority,
      type: createdItem.type,
      assignedToId: createdItem.assignedToId,
      actorId: userId,
      actorName: createdItem.createdBy?.fullName || createdItem.createdBy?.username || null,
    });

    // Invalidate caches
    await cacheService.del(cacheService.keys.projectSummary(projectId));
    if (createdItem.assignedToId) {
      await cacheService.del(cacheService.keys.userMyWork(createdItem.assignedToId));
    }

    // Schedule deadline reminder with exact calculated delay
    await scheduleWorkItemDeadlines(createdItem);

    return createdItem;
  }

  /**
   * Get project work items with filters and aggregated stats
   */
  async getProjectWorkItems(
    projectId: string,
    userId: string,
    filters?: {
      status?: string;
      priority?: string;
      type?: string;
      assignedToId?: string;
      search?: string;
    }
  ) {
    await this.verifyProjectMember(projectId, userId);

    const where: any = { projectId };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.priority) {
      where.priority = filters.priority;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.assignedToId) {
      where.assignedToId = filters.assignedToId;
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Fetch work items and calculate overview statistics
    const [workItems, allItemsForStats] = await Promise.all([
      prisma.workItem.findMany({
        where,
        include: {
          createdBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          assignedTo: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          assignees: {
            include: {
              user: {
                select: { id: true, fullName: true, username: true, avatarUrl: true },
              },
            },
          },
          _count: {
            select: { comments: true },
          },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.workItem.findMany({
        where: { projectId },
        select: { id: true, status: true, dueDate: true },
      }),
    ]);

    const now = new Date();
    const stats = {
      total: allItemsForStats.length,
      todo: allItemsForStats.filter((i) => i.status === 'TODO').length,
      inProgress: allItemsForStats.filter((i) => i.status === 'IN_PROGRESS').length,
      blocked: allItemsForStats.filter((i) => i.status === 'BLOCKED').length,
      inReview: allItemsForStats.filter((i) => i.status === 'IN_REVIEW').length,
      completed: allItemsForStats.filter((i) => i.status === 'COMPLETED').length,
      overdue: allItemsForStats.filter((i) => {
        if (!i.dueDate || i.status === 'COMPLETED') return false;
        return new Date(i.dueDate) < now;
      }).length,
      completionPercentage:
        allItemsForStats.length > 0
          ? Math.round(
              (allItemsForStats.filter((i) => i.status === 'COMPLETED').length /
                allItemsForStats.length) *
                100
            )
          : 0,
    };

    return {
      workItems,
      stats,
    };
  }

  /**
   * Get single work item details with comments and activities
   */
  async getWorkItemById(projectId: string, workItemId: string, userId: string) {
    await this.verifyProjectMember(projectId, userId);

    const workItem = await prisma.workItem.findUnique({
      where: { id: workItemId },
      include: {
        createdBy: {
          select: { id: true, fullName: true, username: true, avatarUrl: true },
        },
        assignedTo: {
          select: { id: true, fullName: true, username: true, avatarUrl: true, email: true },
        },
        assignees: {
          include: {
            user: {
              select: { id: true, fullName: true, username: true, avatarUrl: true, email: true },
            },
          },
        },
        comments: {
          where: { deletedAt: null },
          include: {
            author: {
              select: { id: true, fullName: true, username: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        activities: {
          include: {
            actor: {
              select: { id: true, fullName: true, username: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!workItem || workItem.projectId !== projectId) {
      throw new AppError('Work item not found in this project', 404);
    }

    // Auto-reconcile expired timer sessions (>= 30 mins elapsed without check-in)
    if (workItem.status === 'IN_PROGRESS' && workItem.assignees && workItem.assignees.length > 0) {
      const now = new Date();
      for (const a of workItem.assignees) {
        if (!a.isPaused && a.lastSessionStartedAt && !a.hasCompleted) {
          const elapsed = Math.max(0, Math.floor((now.getTime() - new Date(a.lastSessionStartedAt).getTime()) / 1000));
          if (elapsed >= 1800) {
            await prisma.workItemAssignee.update({
              where: { id: a.id },
              data: {
                totalDurationSeconds: a.totalDurationSeconds + 1800,
                isPaused: true,
                lastSessionStartedAt: null,
                lastCheckInAt: now,
              },
            });
            a.totalDurationSeconds += 1800;
            a.isPaused = true;
            a.lastSessionStartedAt = null;
          }
        }
      }
    }

    return workItem;
  }

  /**
   * Update work item and log relevant activities
   */
  async updateWorkItem(
    projectId: string,
    workItemId: string,
    userId: string,
    data: UpdateWorkItemInput
  ) {
    const { isAdmin, project } = await this.verifyProjectMember(projectId, userId);

    if (project.status === 'ARCHIVED') {
      throw new AppError('Cannot modify work items in an archived project', 400);
    }

    const existing = await prisma.workItem.findUnique({
      where: { id: workItemId },
      include: { assignedTo: true },
    });

    if (!existing || existing.projectId !== projectId) {
      throw new AppError('Work item not found', 404);
    }

    let assigneeIdsToSet: string[] | undefined = undefined;
    if (data.assigneeIds !== undefined && data.assigneeIds !== null) {
      assigneeIdsToSet = Array.from(new Set(data.assigneeIds.map((id) => id.trim()).filter(Boolean)));
    } else if (data.assignedToId !== undefined) {
      assigneeIdsToSet = data.assignedToId && data.assignedToId.trim() ? [data.assignedToId.trim()] : [];
    }

    if (assigneeIdsToSet) {
      for (const aId of assigneeIdsToSet) {
        await this.verifyAssigneeInProject(projectId, aId);
      }
    }

    const assignedToId =
      assigneeIdsToSet !== undefined
        ? assigneeIdsToSet[0] || null
        : data.assignedToId !== undefined
        ? data.assignedToId && data.assignedToId.trim()
          ? data.assignedToId.trim()
          : null
        : undefined;

    if (assignedToId && assignedToId !== existing.assignedToId && !assigneeIdsToSet) {
      await this.verifyAssigneeInProject(projectId, assignedToId);
    }

    const access = await projectService.verifyProjectAccess(projectId, userId);
    const isOwnerOrAdmin = access.isWsOwner || access.isWsAdmin || access.isAdmin;
    const isCreator = existing.createdById === userId;

    // Rule: Only Owner, Workspace Admin, Project Admin, or Task Creator can move tasks or change status directly
    if (data.status !== undefined && data.status !== existing.status) {
      if (!isOwnerOrAdmin && !isCreator) {
        throw new AppError('Only the Task Creator, Project Admin, Workspace Admin, or Workspace Owner can move tasks between columns', 403);
      }
    }

    // Rule: Project members cannot assign tasks to Workspace Owner or Workspace Admin
    if (!isOwnerOrAdmin && assigneeIdsToSet && assigneeIdsToSet.length > 0) {
      const restrictedMembers = await prisma.workspaceMember.findMany({
        where: {
          workspaceId: project.workspaceId,
          OR: [{ role: 'WORKSPACE_ADMIN' }, { role: 'OWNER' }],
        },
        select: { userId: true },
      });
      const restrictedUserIds = new Set(restrictedMembers.map((m) => m.userId));
      if (project.workspace?.ownerId) {
        restrictedUserIds.add(project.workspace.ownerId);
      }

      for (const aId of assigneeIdsToSet) {
        if (restrictedUserIds.has(aId)) {
          throw new AppError('Project members cannot assign tasks to Workspace Owners or Workspace Administrators', 403);
        }
      }
    }

    const updatedItem = await prisma.$transaction(async (tx) => {
      let completedAt = existing.completedAt;
      if (data.status !== undefined) {
        if (data.status === 'COMPLETED' && existing.status !== 'COMPLETED') {
          completedAt = new Date();
        } else if (data.status !== 'COMPLETED' && existing.status === 'COMPLETED') {
          completedAt = null;
        }
      }

      if (assigneeIdsToSet !== undefined) {
        await tx.workItemAssignee.deleteMany({ where: { workItemId } });
        if (assigneeIdsToSet.length > 0) {
          await tx.workItemAssignee.createMany({
            data: assigneeIdsToSet.map((uId) => ({ workItemId, userId: uId })),
            skipDuplicates: true,
          });
        }
      }

      const updated = await tx.workItem.update({
        where: { id: workItemId },
        data: {
          title: data.title !== undefined ? data.title.trim() : undefined,
          description: data.description !== undefined ? (data.description ? data.description.trim() : null) : undefined,
          type: data.type !== undefined ? data.type : undefined,
          status: data.status !== undefined ? data.status : undefined,
          priority: data.priority !== undefined ? data.priority : undefined,
          assignedToId,
          dueDate: data.completedDueDate !== undefined ? (data.completedDueDate ? new Date(data.completedDueDate) : null) : (data.dueDate !== undefined ? (data.dueDate ? new Date(data.dueDate) : null) : undefined),
          todoDueDate: data.todoDueDate !== undefined ? (data.todoDueDate ? new Date(data.todoDueDate) : null) : undefined,
          inProgressDueDate: data.inProgressDueDate !== undefined ? (data.inProgressDueDate ? new Date(data.inProgressDueDate) : null) : undefined,
          inReviewDueDate: data.inReviewDueDate !== undefined ? (data.inReviewDueDate ? new Date(data.inReviewDueDate) : null) : undefined,
          completedDueDate: data.completedDueDate !== undefined ? (data.completedDueDate ? new Date(data.completedDueDate) : null) : undefined,
          completedAt,
        },
        include: {
          createdBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          assignedTo: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          assignees: {
            include: {
              user: {
                select: { id: true, fullName: true, username: true, avatarUrl: true },
              },
            },
          },
        },
      });

      // Log status change
      if (data.status !== undefined && data.status !== existing.status) {
        const isCompleted = data.status === 'COMPLETED';
        await activityService.createActivity(
          {
            projectId,
            actorId: userId,
            type: isCompleted ? 'WORK_COMPLETED' : 'WORK_STATUS_CHANGED',
            workItemId,
            metadata: {
              from: existing.status,
              to: data.status,
              title: updated.title,
            },
          },
          tx
        );

        const recipients = new Set<string>();
        if (updated.assignedToId && updated.assignedToId !== userId) recipients.add(updated.assignedToId);
        if (updated.createdById && updated.createdById !== userId) recipients.add(updated.createdById);

        for (const recipientId of recipients) {
          await notificationService.createNotification(
            {
              recipientId,
              actorId: userId,
              projectId,
              workItemId: updated.id,
              type: isCompleted ? 'WORK_COMPLETED' : 'WORK_STATUS_CHANGED',
              title: isCompleted ? 'Work item completed' : 'Work item status updated',
              message: `"${updated.title}" status changed to ${data.status}`,
              link: `/app/projects/${projectId}/board?item=${updated.id}`,
            },
            tx
          );
        }
      }

      // Log priority change
      if (data.priority !== undefined && data.priority !== existing.priority) {
        await activityService.createActivity(
          {
            projectId,
            actorId: userId,
            type: 'WORK_PRIORITY_CHANGED',
            workItemId,
            metadata: {
              from: existing.priority,
              to: data.priority,
              title: updated.title,
            },
          },
          tx
        );
      }

      // Log assignment change
      if (assignedToId !== undefined && assignedToId !== existing.assignedToId) {
        await activityService.createActivity(
          {
            projectId,
            actorId: userId,
            type: 'WORK_ASSIGNED',
            workItemId,
            metadata: {
              from: existing.assignedToId,
              to: assignedToId,
              assignedToName: updated.assignedTo?.fullName || updated.assignedTo?.username || 'Unassigned',
            },
          },
          tx
        );

        if (assignedToId && assignedToId !== userId) {
          await notificationService.createNotification(
            {
              recipientId: assignedToId,
              actorId: userId,
              projectId,
              workItemId: updated.id,
              type: 'WORK_ASSIGNED',
              title: 'Work item assigned to you',
              message: `You were assigned to "${updated.title}"`,
              link: `/app/projects/${projectId}/board?item=${updated.id}`,
            },
            tx
          );
        }
      }

      return updated;
    });

    // Real-time notification publishing
    if (data.status !== undefined && data.status !== existing.status) {
      const isCompleted = data.status === 'COMPLETED';
      publishToProject(projectId, isCompleted ? 'WORK_COMPLETED' : 'WORK_STATUS_CHANGED', {
        projectId,
        workItemId: updatedItem.id,
        title: updatedItem.title,
        status: updatedItem.status,
        priority: updatedItem.priority,
        type: updatedItem.type,
        assignedToId: updatedItem.assignedToId,
        fromStatus: existing.status,
        toStatus: data.status,
        actorId: userId,
      });
    } else if (assignedToId !== undefined && assignedToId !== existing.assignedToId) {
      publishToProject(projectId, 'WORK_ASSIGNED', {
        projectId,
        workItemId: updatedItem.id,
        title: updatedItem.title,
        status: updatedItem.status,
        priority: updatedItem.priority,
        type: updatedItem.type,
        assignedToId: updatedItem.assignedToId,
        actorId: userId,
      });
    } else {
      publishToProject(projectId, 'WORK_UPDATED', {
        projectId,
        workItemId: updatedItem.id,
        title: updatedItem.title,
        status: updatedItem.status,
        priority: updatedItem.priority,
        type: updatedItem.type,
        assignedToId: updatedItem.assignedToId,
        actorId: userId,
      });
    }

    // Invalidate caches
    await cacheService.del(cacheService.keys.projectSummary(projectId));
    if (updatedItem.assignedToId) {
      await cacheService.del(cacheService.keys.userMyWork(updatedItem.assignedToId));
    }
    if (existing.assignedToId && existing.assignedToId !== updatedItem.assignedToId) {
      await cacheService.del(cacheService.keys.userMyWork(existing.assignedToId));
    }

    // Schedule or reschedule deadline reminder with exact calculated delay
    await scheduleWorkItemDeadlines(updatedItem);

    return updatedItem;
  }

  /**
   * Delete work item (Admin or Creator only)
   */
  async deleteWorkItem(projectId: string, workItemId: string, userId: string) {
    const { isAdmin, project } = await this.verifyProjectMember(projectId, userId);

    if (project.status === 'ARCHIVED') {
      throw new AppError('Cannot delete work items in an archived project', 400);
    }

    const existing = await prisma.workItem.findUnique({
      where: { id: workItemId },
    });

    if (!existing || existing.projectId !== projectId) {
      throw new AppError('Work item not found', 404);
    }

    if (!isAdmin && existing.createdById !== userId) {
      throw new AppError('Only project administrators or the creator can delete this work item', 403);
    }

    await prisma.workItem.delete({
      where: { id: workItemId },
    });

    // Cancel pending BullMQ deadline reminder jobs
    await cancelDeadlineJobs(workItemId);

    publishToProject(projectId, 'WORK_DELETED', {
      projectId,
      workItemId,
      actorId: userId,
    });

    // Invalidate caches
    await cacheService.del(cacheService.keys.projectSummary(projectId));
    if (existing.assignedToId) {
      await cacheService.del(cacheService.keys.userMyWork(existing.assignedToId));
    }

    return { success: true };
  }

  /**
   * Get aggregated work items for authenticated user across authorized projects with role-based visibility
   */
  async getMyWorkItems(
    userId: string,
    params?: {
      tab?: 'my-work' | 'created-work' | 'overdue' | 'due-soon' | 'completed' | 'blocked' | 'canceled' | 'all';
      status?: string;
      priority?: string;
      type?: string;
      projectId?: string;
      search?: string;
      sort?: 'dueDate' | 'priority' | 'recentlyUpdated' | 'recentlyCreated';
      page?: number;
      limit?: number;
    },
    workspaceId?: string
  ) {
    // 1. Fetch workspace role & accessible projects in the active workspace
    let isWorkspaceOwnerOrAdmin = false;
    let workspaceProjectIds: string[] = [];

    if (workspaceId) {
      const ws = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: {
          members: {
            where: { userId },
          },
        },
      });

      if (ws) {
        if (ws.ownerId === userId) {
          isWorkspaceOwnerOrAdmin = true;
        } else if (ws.members.length > 0) {
          const role = ws.members[0].role;
          if (role === 'OWNER' || role === 'WORKSPACE_ADMIN') {
            isWorkspaceOwnerOrAdmin = true;
          }
        }
      }

      if (isWorkspaceOwnerOrAdmin) {
        const wsProjects = await prisma.project.findMany({
          where: { workspaceId, status: { not: 'ARCHIVED' } },
          select: { id: true },
        });
        workspaceProjectIds = wsProjects.map((p) => p.id);
      }
    }

    // Projects where user is member or admin
    const userMemberships = await prisma.projectMember.findMany({
      where: {
        userId,
        project: workspaceId ? { workspaceId, status: { not: 'ARCHIVED' } } : { status: { not: 'ARCHIVED' } },
      },
      select: {
        projectId: true,
        role: true,
        project: {
          select: { id: true, createdById: true },
        },
      },
    });

    const projectAdminIds = new Set<string>();
    const projectMemberIds = new Set<string>();

    for (const m of userMemberships) {
      if (m.role === 'PROJECT_ADMIN' || m.project.createdById === userId) {
        projectAdminIds.add(m.projectId);
      } else {
        projectMemberIds.add(m.projectId);
      }
    }

    // Determine project scope
    const allAccessibleProjectIds = isWorkspaceOwnerOrAdmin
      ? workspaceProjectIds
      : Array.from(new Set([...projectAdminIds, ...projectMemberIds]));

    if (allAccessibleProjectIds.length === 0) {
      return {
        workItems: [],
        summary: { total: 0, createdTotal: 0, inProgress: 0, dueSoon: 0, overdue: 0, blocked: 0, completed: 0 },
        pagination: { page: 1, limit: params?.limit || 200, total: 0, totalPages: 0 },
      };
    }

    const now = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(now.getDate() + 7);

    // 2. Role-based visibility condition:
    // - Workspace Owner / Admin: sees all tasks in workspace projects
    // - Project Admin: sees all tasks in projects they admin
    // - Project Member: sees only tasks they are part of (assigned, in assignees, or created by them)
    let visibilityFilter: any = {};

    if (isWorkspaceOwnerOrAdmin) {
      visibilityFilter = {
        projectId: params?.projectId ? params.projectId : { in: workspaceProjectIds },
      };
    } else {
      const targetProjId = params?.projectId;
      if (targetProjId) {
        if (!allAccessibleProjectIds.includes(targetProjId)) {
          throw new AppError('You do not have access to the specified project', 403);
        }
        if (projectAdminIds.has(targetProjId)) {
          visibilityFilter = { projectId: targetProjId };
        } else {
          visibilityFilter = {
            projectId: targetProjId,
            OR: [
              { assignedToId: userId },
              { createdById: userId },
              { assignees: { some: { userId } } },
            ],
          };
        }
      } else {
        const conditions: any[] = [];
        if (projectAdminIds.size > 0) {
          conditions.push({ projectId: { in: Array.from(projectAdminIds) } });
        }
        if (projectMemberIds.size > 0) {
          conditions.push({
            projectId: { in: Array.from(projectMemberIds) },
            OR: [
              { assignedToId: userId },
              { createdById: userId },
              { assignees: { some: { userId } } },
            ],
          });
        }
        visibilityFilter = conditions.length > 1 ? { OR: conditions } : conditions[0] || {};
      }
    }

    // 3. Compute user summary metrics based on their visible scope
    const [assignedOrPartItems, createdItems] = await Promise.all([
      prisma.workItem.findMany({
        where: {
          ...visibilityFilter,
          OR: [
            { assignedToId: userId },
            { assignees: { some: { userId } } },
          ],
        },
        select: {
          id: true,
          status: true,
          dueDate: true,
        },
      }),
      prisma.workItem.findMany({
        where: {
          ...visibilityFilter,
          createdById: userId,
        },
        select: {
          id: true,
          status: true,
          dueDate: true,
        },
      }),
    ]);

    const summary = {
      total: assignedOrPartItems.length,
      createdTotal: createdItems.length,
      inProgress: assignedOrPartItems.filter((i) => i.status === 'IN_PROGRESS').length,
      dueSoon: assignedOrPartItems.filter((i) => {
        if (!i.dueDate || i.status === 'COMPLETED') return false;
        const due = new Date(i.dueDate);
        return due >= now && due <= sevenDaysLater;
      }).length,
      overdue: assignedOrPartItems.filter((i) => {
        if (!i.dueDate || i.status === 'COMPLETED') return false;
        return new Date(i.dueDate) < now;
      }).length,
      blocked: assignedOrPartItems.filter((i) => i.status === 'BLOCKED').length,
      canceled: assignedOrPartItems.filter((i) => i.status === 'BLOCKED').length,
      completed: assignedOrPartItems.filter((i) => i.status === 'COMPLETED').length,
    };

    // 4. Build dynamic query filters
    const where: any = {
      ...visibilityFilter,
    };

    const tab = params?.tab;
    if (tab === 'created-work') {
      where.createdById = userId;
    } else if (tab === 'overdue') {
      where.status = { not: 'COMPLETED' };
      where.dueDate = { lt: now };
    } else if (tab === 'due-soon') {
      where.status = { not: 'COMPLETED' };
      where.dueDate = { gte: now, lte: sevenDaysLater };
    } else if (tab === 'completed') {
      where.status = 'COMPLETED';
    } else if (tab === 'blocked' || tab === 'canceled') {
      where.status = 'BLOCKED';
    }

    if (params?.status) {
      where.status = params.status;
    }

    if (params?.priority) {
      where.priority = params.priority;
    }

    if (params?.type) {
      where.type = params.type;
    }

    if (params?.search && params.search.trim()) {
      const q = params.search.trim();
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
      ];
    }

    // 5. Sorting
    let orderBy: any = { createdAt: 'desc' };
    if (params?.sort === 'dueDate') {
      orderBy = { dueDate: 'asc' };
    } else if (params?.sort === 'priority') {
      orderBy = { priority: 'desc' };
    } else if (params?.sort === 'recentlyUpdated') {
      orderBy = { updatedAt: 'desc' };
    }

    // 6. Pagination - default 200 for complete Kanban board experience
    const page = Math.max(1, params?.page || 1);
    const limit = Math.min(1000, Math.max(1, params?.limit || 200));
    const skip = (page - 1) * limit;

    const [workItems, total] = await Promise.all([
      prisma.workItem.findMany({
        where,
        include: {
          project: {
            select: { id: true, name: true, key: true, avatarUrl: true },
          },
          assignedTo: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          assignees: {
            include: {
              user: {
                select: { id: true, fullName: true, username: true, avatarUrl: true },
              },
            },
          },
          createdBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          _count: {
            select: { comments: true },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.workItem.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      workItems,
      summary,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Assignee starts their work on a task (TODO -> IN_PROGRESS when all start)
   */
  async startTask(projectId: string, workItemId: string, userId: string) {
    await this.verifyProjectMember(projectId, userId);
    const existing = await prisma.workItem.findUnique({
      where: { id: workItemId },
      include: { assignees: true },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new AppError('Work item not found', 404);
    }
    const assignee = existing.assignees.find((a) => a.userId === userId);
    if (!assignee) {
      throw new AppError('You are not assigned to this work item', 403);
    }

    const now = new Date();
    await prisma.workItemAssignee.update({
      where: { id: assignee.id },
      data: {
        hasStarted: true,
        startedAt: assignee.startedAt || now,
        lastSessionStartedAt: now,
        isPaused: false,
        lastCheckInCycle: 1,
        lastCheckInAt: now,
      },
    });

    // Check if ALL assignees have started
    const allAssignees = await prisma.workItemAssignee.findMany({
      where: { workItemId },
    });
    const allStarted = allAssignees.length > 0 && allAssignees.every((a) => a.hasStarted);
    if (allStarted && existing.status === 'TODO') {
      await prisma.workItem.update({
        where: { id: workItemId },
        data: { status: 'IN_PROGRESS' },
      });
      // Synchronize all assignees' timers so they start active together in IN_PROGRESS
      await prisma.workItemAssignee.updateMany({
        where: { workItemId },
        data: {
          lastSessionStartedAt: now,
          lastCheckInAt: now,
          isPaused: false,
        },
      });
      publishToProject(projectId, 'WORK_STATUS_CHANGED', {
        id: workItemId,
        status: 'IN_PROGRESS',
        from: 'TODO',
      });
    }

    const updatedItem = await this.getWorkItemById(projectId, workItemId, userId);
    publishToProject(projectId, 'WORK_UPDATED', { workItem: updatedItem });
    return updatedItem;
  }

  /**
   * Assignee checks in between minute 25 and 30 to keep timer running
   */
  async checkInTimer(projectId: string, workItemId: string, userId: string) {
    await this.verifyProjectMember(projectId, userId);
    const assignee = await prisma.workItemAssignee.findFirst({
      where: { workItemId, userId },
    });
    if (!assignee) {
      throw new AppError('Assignee record not found', 404);
    }

    const now = new Date();
    let additionalSeconds = 0;
    if (!assignee.isPaused && assignee.lastSessionStartedAt) {
      const elapsed = Math.max(0, Math.floor((now.getTime() - new Date(assignee.lastSessionStartedAt).getTime()) / 1000));
      additionalSeconds = Math.min(elapsed, 1800); // Capped at 30 min (1800s)
    }

    await prisma.workItemAssignee.update({
      where: { id: assignee.id },
      data: {
        totalDurationSeconds: assignee.totalDurationSeconds + additionalSeconds,
        lastSessionStartedAt: now,
        isPaused: false,
        lastCheckInCycle: (assignee.lastCheckInCycle || 0) + 1,
        lastCheckInAt: now,
      },
    });

    const updatedItem = await this.getWorkItemById(projectId, workItemId, userId);
    publishToProject(projectId, 'WORK_UPDATED', { workItem: updatedItem });
    return updatedItem;
  }

  /**
   * Assignee resumes a paused timer
   */
  async resumeTimer(projectId: string, workItemId: string, userId: string) {
    await this.verifyProjectMember(projectId, userId);
    const assignee = await prisma.workItemAssignee.findFirst({
      where: { workItemId, userId },
    });
    if (!assignee) {
      throw new AppError('Assignee record not found', 404);
    }

    const now = new Date();
    // Credit any previously uncredited time from a session that expired past 1800s
    let additionalSeconds = 0;
    if (assignee.lastSessionStartedAt) {
      const elapsed = Math.max(0, Math.floor((now.getTime() - new Date(assignee.lastSessionStartedAt).getTime()) / 1000));
      additionalSeconds = Math.min(elapsed, 1800);
    }

    await prisma.workItemAssignee.update({
      where: { id: assignee.id },
      data: {
        totalDurationSeconds: assignee.totalDurationSeconds + additionalSeconds,
        isPaused: false,
        lastSessionStartedAt: now,
        lastCheckInAt: now,
      },
    });

    const updatedItem = await this.getWorkItemById(projectId, workItemId, userId);
    publishToProject(projectId, 'WORK_UPDATED', { workItem: updatedItem });
    return updatedItem;
  }

  /**
   * Assignee marks their work as done
   */
  async completeWork(projectId: string, workItemId: string, userId: string) {
    await this.verifyProjectMember(projectId, userId);
    const existing = await prisma.workItem.findUnique({
      where: { id: workItemId },
      include: { assignees: true },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new AppError('Work item not found', 404);
    }
    const assignee = existing.assignees.find((a) => a.userId === userId);
    if (!assignee) {
      throw new AppError('You are not assigned to this work item', 403);
    }

    const now = new Date();
    let additionalSeconds = 0;
    if (!assignee.isPaused && assignee.lastSessionStartedAt) {
      const elapsed = Math.max(0, Math.floor((now.getTime() - new Date(assignee.lastSessionStartedAt).getTime()) / 1000));
      additionalSeconds = Math.min(elapsed, 1800); // Capped at 30 min (1800s)
    }

    await prisma.workItemAssignee.update({
      where: { id: assignee.id },
      data: {
        hasCompleted: true,
        completedAt: now,
        isPaused: true,
        lastSessionStartedAt: null,
        totalDurationSeconds: assignee.totalDurationSeconds + additionalSeconds,
      },
    });

    // Check if ALL assignees have completed
    const allAssignees = await prisma.workItemAssignee.findMany({
      where: { workItemId },
    });
    const allCompleted = allAssignees.length > 0 && allAssignees.every((a) => a.hasCompleted);
    if (allCompleted && (existing.status === 'IN_PROGRESS' || existing.status === 'TODO')) {
      await prisma.workItem.update({
        where: { id: workItemId },
        data: { status: 'IN_REVIEW' },
      });
      publishToProject(projectId, 'WORK_STATUS_CHANGED', {
        id: workItemId,
        status: 'IN_REVIEW',
        from: existing.status,
      });
    }

    const updatedItem = await this.getWorkItemById(projectId, workItemId, userId);
    publishToProject(projectId, 'WORK_UPDATED', { workItem: updatedItem });
    return updatedItem;
  }

  /**
   * Creator, Project Admin, Workspace Admin, or Workspace Owner reviews task
   */
  async reviewTask(projectId: string, workItemId: string, userId: string, data: ReviewTaskInput) {
    const access = await projectService.verifyProjectAccess(projectId, userId);
    const existing = await prisma.workItem.findUnique({
      where: { id: workItemId },
      include: { assignees: true },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new AppError('Work item not found', 404);
    }

    const canReview = access.isWsOwner || access.isWsAdmin || access.isAdmin || existing.createdById === userId;
    if (!canReview) {
      throw new AppError('Only the Task Creator, Project Admin, Workspace Admin, or Workspace Owner can review tasks', 403);
    }

    const now = new Date();
    if (data.action === 'APPROVE') {
      await prisma.workItem.update({
        where: { id: workItemId },
        data: {
          status: 'COMPLETED',
          completedAt: now,
          approvedAt: now,
          approvedById: userId,
        },
      });
      publishToProject(projectId, 'WORK_STATUS_CHANGED', {
        id: workItemId,
        status: 'COMPLETED',
        from: existing.status,
      });
    } else {
      // REJECT: Move back to IN_PROGRESS, preserve duration seconds, set hasCompleted = false
      await prisma.$transaction([
        prisma.workItem.update({
          where: { id: workItemId },
          data: {
            status: 'IN_PROGRESS',
            rejectionReason: data.reason || 'Work rejected by reviewer',
            rejectedAt: now,
            rejectedById: userId,
          },
        }),
        prisma.workItemAssignee.updateMany({
          where: { workItemId },
          data: {
            hasCompleted: false,
            isPaused: true,
            lastSessionStartedAt: null,
          },
        }),
      ]);
      publishToProject(projectId, 'WORK_STATUS_CHANGED', {
        id: workItemId,
        status: 'IN_PROGRESS',
        from: existing.status,
      });
    }

    const updatedItem = await this.getWorkItemById(projectId, workItemId, userId);
    publishToProject(projectId, 'WORK_UPDATED', { workItem: updatedItem });
    return updatedItem;
  }
}

export const workService = new WorkService();

