import { prisma } from '../prisma.js';
import { CreateWorkItemInput, UpdateWorkItemInput } from '../schemas/work.schema.js';
import { activityService } from './activity.service.js';
import { notificationService } from './notification.service.js';
import { AppError } from '../middlewares/error.middleware.js';
import { publishToProject } from '../realtime/realtime.service.js';
import { scheduleWorkItemDeadlines, cancelDeadlineJobs } from '../jobs/queues.js';
import { cacheService } from '../redis/cache.service.js';

export class WorkService {
  /**
   * Helper to verify project membership
   */
  private async verifyProjectMember(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: { where: { userId } },
      },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const isCreator = project.createdById === userId;
    const member = project.members[0];

    if (!isCreator && !member) {
      throw new AppError('You are not a member of this project', 403);
    }

    const role = member ? member.role : isCreator ? 'PROJECT_ADMIN' : 'PROJECT_MEMBER';
    return { project, role, isAdmin: role === 'PROJECT_ADMIN' };
  }

  /**
   * Helper to verify that an assigned user belongs to the project
   */
  private async verifyAssigneeInProject(projectId: string, assignedToId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: { where: { userId: assignedToId } },
      },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const isCreator = project.createdById === assignedToId;
    const isMember = project.members.length > 0;

    if (!isCreator && !isMember) {
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

    const assignedToId = data.assignedToId && data.assignedToId.trim() ? data.assignedToId.trim() : null;

    if (assignedToId) {
      await this.verifyAssigneeInProject(projectId, assignedToId);
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
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          completedAt: isCompleted ? new Date() : null,
        },
        include: {
          createdBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          assignedTo: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
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

      // Log WORK_ASSIGNED activity if assignee was set on creation
      if (assignedToId) {
        await activityService.createActivity(
          {
            projectId,
            actorId: userId,
            type: 'WORK_ASSIGNED',
            workItemId: workItem.id,
            metadata: {
              assignedToId,
              assignedToName: workItem.assignedTo?.fullName || workItem.assignedTo?.username,
            },
          },
          tx
        );

        if (assignedToId !== userId) {
          await notificationService.createNotification(
            {
              recipientId: assignedToId,
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

    const assignedToId =
      data.assignedToId !== undefined
        ? data.assignedToId && data.assignedToId.trim()
          ? data.assignedToId.trim()
          : null
        : undefined;

    if (assignedToId && assignedToId !== existing.assignedToId) {
      await this.verifyAssigneeInProject(projectId, assignedToId);
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

      const updated = await tx.workItem.update({
        where: { id: workItemId },
        data: {
          title: data.title !== undefined ? data.title.trim() : undefined,
          description: data.description !== undefined ? (data.description ? data.description.trim() : null) : undefined,
          type: data.type !== undefined ? data.type : undefined,
          status: data.status !== undefined ? data.status : undefined,
          priority: data.priority !== undefined ? data.priority : undefined,
          assignedToId,
          dueDate: data.dueDate !== undefined ? (data.dueDate ? new Date(data.dueDate) : null) : undefined,
          completedAt,
        },
        include: {
          createdBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          assignedTo: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
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
   * Get aggregated work items for authenticated user across authorized projects
   */
  async getMyWorkItems(
    userId: string,
    params?: {
      tab?: 'my-work' | 'created-work' | 'overdue' | 'due-soon' | 'completed' | 'all';
      status?: string;
      priority?: string;
      type?: string;
      projectId?: string;
      search?: string;
      sort?: 'dueDate' | 'priority' | 'recentlyUpdated' | 'recentlyCreated';
      page?: number;
      limit?: number;
    }
  ) {
    // 1. Fetch all project IDs where user is creator or member
    const userProjects = await prisma.project.findMany({
      where: {
        OR: [
          { createdById: userId },
          { members: { some: { userId } } },
        ],
      },
      select: { id: true },
    });

    const projectIds = userProjects.map((p) => p.id);

    if (projectIds.length === 0) {
      return {
        workItems: [],
        summary: { total: 0, createdTotal: 0, inProgress: 0, dueSoon: 0, overdue: 0, completed: 0 },
        pagination: { page: 1, limit: params?.limit || 10, total: 0, totalPages: 0 },
      };
    }

    const now = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(now.getDate() + 7);

    // 2. Compute user's summary metrics across all assigned and created items
    const [userAssignedItems, userCreatedItems] = await Promise.all([
      prisma.workItem.findMany({
        where: {
          projectId: { in: projectIds },
          assignedToId: userId,
        },
        select: {
          id: true,
          status: true,
          dueDate: true,
        },
      }),
      prisma.workItem.findMany({
        where: {
          projectId: { in: projectIds },
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
      total: userAssignedItems.length,
      createdTotal: userCreatedItems.length,
      inProgress: userAssignedItems.filter((i) => i.status === 'IN_PROGRESS').length,
      dueSoon: userAssignedItems.filter((i) => {
        if (!i.dueDate || i.status === 'COMPLETED') return false;
        const due = new Date(i.dueDate);
        return due >= now && due <= sevenDaysLater;
      }).length,
      overdue: userAssignedItems.filter((i) => {
        if (!i.dueDate || i.status === 'COMPLETED') return false;
        return new Date(i.dueDate) < now;
      }).length,
      completed: userAssignedItems.filter((i) => i.status === 'COMPLETED').length,
    };

    // 3. Build dynamic query filters
    const where: any = {
      projectId: params?.projectId ? params.projectId : { in: projectIds },
    };

    // If specific projectId requested, ensure user has access
    if (params?.projectId && !projectIds.includes(params.projectId)) {
      throw new AppError('You do not have access to the specified project', 403);
    }

    const tab = params?.tab || 'my-work';

    if (tab === 'my-work') {
      where.assignedToId = userId;
    } else if (tab === 'created-work') {
      where.createdById = userId;
    } else if (tab === 'overdue') {
      where.assignedToId = userId;
      where.status = { not: 'COMPLETED' };
      where.dueDate = { lt: now };
    } else if (tab === 'due-soon') {
      where.assignedToId = userId;
      where.status = { not: 'COMPLETED' };
      where.dueDate = { gte: now, lte: sevenDaysLater };
    } else if (tab === 'completed') {
      where.assignedToId = userId;
      where.status = 'COMPLETED';
    } else if (tab === 'all') {
      // All items in user's accessible projects
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

    // 4. Sorting
    let orderBy: any = { createdAt: 'desc' };
    if (params?.sort === 'dueDate') {
      orderBy = { dueDate: 'asc' };
    } else if (params?.sort === 'priority') {
      orderBy = { priority: 'desc' };
    } else if (params?.sort === 'recentlyUpdated') {
      orderBy = { updatedAt: 'desc' };
    }

    // 5. Pagination
    const page = Math.max(1, params?.page || 1);
    const limit = Math.min(100, Math.max(1, params?.limit || 10));
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
}

export const workService = new WorkService();

