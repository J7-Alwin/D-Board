import { prisma } from '../prisma.js';
import { AppError } from '../middlewares/error.middleware.js';
import { activityService } from './activity.service.js';
import { notificationService } from './notification.service.js';
import { publishToProject } from '../realtime/realtime.service.js';
import type {
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  CalendarQueryParams,
} from '../schemas/calendar.schema.js';

export class CalendarService {
  /**
   * Helper to verify project membership and determine admin status.
   */
  private async getMembershipAndProject(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, createdById: true },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    const isOwner = project.createdById === userId;
    const isMember = !!membership || isOwner;

    if (!isMember) {
      throw new AppError('You are not authorized to access this project calendar', 403);
    }

    const isAdmin = isOwner || membership?.role === 'PROJECT_ADMIN';

    return { project, membership, isAdmin };
  }

  /**
   * Unified calendar query combining CalendarEvent items and WorkItem due date deadlines.
   */
  async getCalendarItems(userId: string, params: CalendarQueryParams) {
    // 1. Determine accessible projects
    const [memberships, ownedProjects] = await Promise.all([
      prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true },
      }),
      prisma.project.findMany({
        where: { createdById: userId },
        select: { id: true },
      }),
    ]);

    const accessibleProjectIds = Array.from(
      new Set([
        ...memberships.map((m) => m.projectId),
        ...ownedProjects.map((p) => p.id),
      ])
    );

    if (accessibleProjectIds.length === 0) {
      return { items: [], range: { start: '', end: '' } };
    }

    let targetProjectIds = accessibleProjectIds;
    if (params.projectId) {
      if (!accessibleProjectIds.includes(params.projectId)) {
        throw new AppError('You are not authorized to view this project calendar', 403);
      }
      targetProjectIds = [params.projectId];
    }

    // 2. Determine date range
    let rangeStart: Date;
    let rangeEnd: Date;

    if (params.start && params.end) {
      rangeStart = new Date(params.start);
      rangeEnd = new Date(params.end);
    } else {
      // Default: 42 days window around current date
      const now = new Date();
      rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
      rangeStart.setDate(rangeStart.getDate() - 7);
      rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      rangeEnd.setDate(rangeEnd.getDate() + 14);
    }

    const filterType = params.type || 'ALL';
    const shouldFetchEvents =
      filterType === 'ALL' ||
      filterType === 'EVENT' ||
      ['MEETING', 'MILESTONE', 'RELEASE', 'DEADLINE', 'OTHER'].includes(filterType);

    const shouldFetchWorkItems =
      filterType === 'ALL' || filterType === 'WORK' || filterType === 'DEADLINE';

    // 3. Fetch CalendarEvents
    let eventsPromise: Promise<any[]> = Promise.resolve([]);
    if (shouldFetchEvents) {
      const eventWhere: any = {
        projectId: { in: targetProjectIds },
        startAt: { lte: rangeEnd },
        endAt: { gte: rangeStart },
      };

      if (
        filterType !== 'ALL' &&
        filterType !== 'EVENT' &&
        ['MEETING', 'MILESTONE', 'RELEASE', 'DEADLINE', 'OTHER'].includes(filterType)
      ) {
        eventWhere.type = filterType;
      }

      if (params.search && params.search.trim()) {
        const search = params.search.trim();
        eventWhere.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { location: { contains: search, mode: 'insensitive' } },
        ];
      }

      eventsPromise = prisma.calendarEvent.findMany({
        where: eventWhere,
        include: {
          createdBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          updatedBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          project: {
            select: { id: true, name: true, key: true, avatarUrl: true },
          },
          relatedWorkItem: {
            select: { id: true, title: true, type: true, status: true, priority: true },
          },
          attendees: {
            include: {
              user: {
                select: { id: true, fullName: true, username: true, avatarUrl: true },
              },
            },
          },
        },
        orderBy: { startAt: 'asc' },
      });
    }

    // 4. Fetch WorkItem Deadlines
    let workItemsPromise: Promise<any[]> = Promise.resolve([]);
    if (shouldFetchWorkItems) {
      const workWhere: any = {
        projectId: { in: targetProjectIds },
        dueDate: {
          gte: rangeStart,
          lte: rangeEnd,
        },
      };

      if (params.search && params.search.trim()) {
        const search = params.search.trim();
        workWhere.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      workItemsPromise = prisma.workItem.findMany({
        where: workWhere,
        include: {
          assignedTo: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          createdBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          project: {
            select: { id: true, name: true, key: true, avatarUrl: true },
          },
        },
        orderBy: { dueDate: 'asc' },
      });
    }

    const [events, workItems] = await Promise.all([eventsPromise, workItemsPromise]);

    const now = new Date();

    // 5. Normalize into unified items
    const normalizedEvents = events.map((event) => ({
      id: event.id,
      kind: 'EVENT' as const,
      type: event.type,
      title: event.title,
      description: event.description,
      startAt: event.startAt.toISOString(),
      endAt: event.endAt.toISOString(),
      allDay: event.allDay,
      location: event.location,
      projectId: event.projectId,
      project: event.project,
      isOverdue: false,
      createdBy: event.createdBy,
      updatedBy: event.updatedBy,
      relatedWorkItemId: event.relatedWorkItemId,
      relatedWorkItem: event.relatedWorkItem,
      attendees: event.attendees ? event.attendees.map((a: any) => a.user) : [],
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    }));

    const normalizedWorkDeadlines = workItems.map((work) => {
      const isOverdue = work.dueDate < now && work.status !== 'COMPLETED';
      return {
        id: `work_${work.id}`,
        kind: 'WORK_ITEM' as const,
        type: 'DEADLINE' as const,
        title: work.title,
        description: work.description,
        startAt: work.dueDate.toISOString(),
        endAt: work.dueDate.toISOString(),
        allDay: true,
        location: null,
        projectId: work.projectId,
        project: work.project,
        isOverdue,
        workItem: {
          id: work.id,
          title: work.title,
          type: work.type,
          status: work.status,
          priority: work.priority,
          assignedTo: work.assignedTo,
          dueDate: work.dueDate.toISOString(),
        },
        createdBy: work.createdBy,
        updatedBy: null,
        relatedWorkItemId: work.id,
        relatedWorkItem: null,
        attendees: work.assignedTo ? [work.assignedTo] : [],
        createdAt: work.createdAt.toISOString(),
        updatedAt: work.updatedAt.toISOString(),
      };
    });

    const unifiedItems = [...normalizedEvents, ...normalizedWorkDeadlines].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );

    return {
      items: unifiedItems,
      range: {
        start: rangeStart.toISOString(),
        end: rangeEnd.toISOString(),
      },
      stats: {
        total: unifiedItems.length,
        events: normalizedEvents.length,
        workDeadlines: normalizedWorkDeadlines.length,
      },
    };
  }

  /**
   * Get single calendar event by ID.
   */
  async getCalendarEventById(projectId: string, eventId: string, userId: string) {
    await this.getMembershipAndProject(projectId, userId);

    const event = await prisma.calendarEvent.findFirst({
      where: { id: eventId, projectId },
      include: {
        createdBy: {
          select: { id: true, fullName: true, username: true, avatarUrl: true },
        },
        updatedBy: {
          select: { id: true, fullName: true, username: true, avatarUrl: true },
        },
        project: {
          select: { id: true, name: true, key: true, avatarUrl: true },
        },
        relatedWorkItem: {
          select: { id: true, title: true, type: true, status: true, priority: true },
        },
        attendees: {
          include: {
            user: {
              select: { id: true, fullName: true, username: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!event) {
      throw new AppError('Calendar event not found', 404);
    }

    return {
      ...event,
      attendees: event.attendees ? event.attendees.map((a: any) => a.user) : [],
    };
  }

  /**
   * Create calendar event.
   */
  async createCalendarEvent(
    projectId: string,
    userId: string,
    data: CreateCalendarEventInput
  ) {
    await this.getMembershipAndProject(projectId, userId);

    // If relatedWorkItemId is provided, verify it belongs to this project
    if (data.relatedWorkItemId) {
      const workItem = await prisma.workItem.findFirst({
        where: { id: data.relatedWorkItemId, projectId },
      });
      if (!workItem) {
        throw new AppError('Related work item does not belong to this project', 400);
      }
    }

    const attendeeIds = data.attendeeIds || [];

    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.calendarEvent.create({
        data: {
          projectId,
          title: data.title,
          description: data.description,
          type: data.type || 'MEETING',
          startAt: new Date(data.startAt),
          endAt: new Date(data.endAt),
          allDay: data.allDay ?? false,
          location: data.location,
          relatedWorkItemId: data.relatedWorkItemId,
          createdById: userId,
          attendees: attendeeIds.length > 0 ? {
            create: attendeeIds.map((uId: string) => ({ userId: uId })),
          } : undefined,
        },
        include: {
          createdBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          updatedBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          project: {
            select: { id: true, name: true, key: true, avatarUrl: true },
          },
          relatedWorkItem: {
            select: { id: true, title: true, type: true, status: true, priority: true },
          },
          attendees: {
            include: {
              user: {
                select: { id: true, fullName: true, username: true, avatarUrl: true },
              },
            },
          },
        },
      });

      await activityService.createActivity(
        {
          projectId,
          actorId: userId,
          type: 'CALENDAR_EVENT_CREATED',
          calendarEventId: created.id,
          metadata: {
            title: created.title,
            eventType: created.type,
            startAt: created.startAt.toISOString(),
            attendeeIds,
          },
        },
        tx
      );

      // Notify invited attendees
      const actorName = created.createdBy?.fullName || created.createdBy?.username || 'A team member';
      for (const attendeeId of attendeeIds) {
        if (attendeeId !== userId) {
          await notificationService.createNotification(
            {
              recipientId: attendeeId,
              actorId: userId,
              projectId,
              type: 'CALENDAR_EVENT_CREATED',
              title: 'Invited to Calendar Event',
              message: `${actorName} invited you to "${created.title}" in ${created.project.name}`,
              link: `/app/calendar?projectId=${projectId}&eventId=${created.id}`,
            },
            tx
          );
        }
      }

      return created;
    });

    publishToProject(projectId, 'CALENDAR_EVENT_CREATED', {
      projectId,
      eventId: event.id,
      title: event.title,
      type: event.type,
      startAt: event.startAt.toISOString(),
      endAt: event.endAt.toISOString(),
      actorId: userId,
      actorName: event.createdBy?.fullName || event.createdBy?.username || null,
      attendeeIds,
    });

    return {
      ...event,
      attendees: event.attendees ? event.attendees.map((a: any) => a.user) : [],
    };
  }

  /**
   * Update calendar event.
   */
  async updateCalendarEvent(
    projectId: string,
    eventId: string,
    userId: string,
    data: UpdateCalendarEventInput
  ) {
    const { isAdmin } = await this.getMembershipAndProject(projectId, userId);

    const existing = await prisma.calendarEvent.findFirst({
      where: { id: eventId, projectId },
    });

    if (!existing) {
      throw new AppError('Calendar event not found', 404);
    }

    const isAuthor = existing.createdById === userId;
    if (!isAdmin && !isAuthor) {
      throw new AppError('You do not have permission to edit this event', 403);
    }

    if (data.relatedWorkItemId) {
      const workItem = await prisma.workItem.findFirst({
        where: { id: data.relatedWorkItemId, projectId },
      });
      if (!workItem) {
        throw new AppError('Related work item does not belong to this project', 400);
      }
    }

    const attendeeIds = data.attendeeIds;

    const updated = await prisma.$transaction(async (tx) => {
      if (attendeeIds !== undefined) {
        await tx.calendarEventAttendee.deleteMany({
          where: { calendarEventId: eventId },
        });

        if (attendeeIds.length > 0) {
          await tx.calendarEventAttendee.createMany({
            data: attendeeIds.map((uId: string) => ({
              calendarEventId: eventId,
              userId: uId,
            })),
          });
        }
      }

      const res = await tx.calendarEvent.update({
        where: { id: eventId },
        data: {
          title: data.title,
          description: data.description,
          type: data.type,
          startAt: data.startAt ? new Date(data.startAt) : undefined,
          endAt: data.endAt ? new Date(data.endAt) : undefined,
          allDay: data.allDay,
          location: data.location,
          relatedWorkItemId: data.relatedWorkItemId,
          updatedById: userId,
        },
        include: {
          createdBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          updatedBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          project: {
            select: { id: true, name: true, key: true, avatarUrl: true },
          },
          relatedWorkItem: {
            select: { id: true, title: true, type: true, status: true, priority: true },
          },
          attendees: {
            include: {
              user: {
                select: { id: true, fullName: true, username: true, avatarUrl: true },
              },
            },
          },
        },
      });

      await activityService.createActivity(
        {
          projectId,
          actorId: userId,
          type: 'CALENDAR_EVENT_UPDATED',
          calendarEventId: eventId,
          metadata: {
            title: res.title,
            eventType: res.type,
            attendeeIds: attendeeIds || [],
          },
        },
        tx
      );

      // Notify invited attendees
      if (attendeeIds && attendeeIds.length > 0) {
        const actorName = res.updatedBy?.fullName || res.updatedBy?.username || 'A team member';
        for (const attendeeId of attendeeIds) {
          if (attendeeId !== userId) {
            await notificationService.createNotification(
              {
                recipientId: attendeeId,
                actorId: userId,
                projectId,
                type: 'CALENDAR_EVENT_UPDATED',
                title: 'Calendar Event Updated',
                message: `${actorName} updated event: "${res.title}" in ${res.project.name}`,
                link: `/app/calendar?projectId=${projectId}&eventId=${res.id}`,
              },
              tx
            );
          }
        }
      }

      return res;
    });

    publishToProject(projectId, 'CALENDAR_EVENT_UPDATED', {
      projectId,
      eventId: updated.id,
      title: updated.title,
      type: updated.type,
      startAt: updated.startAt.toISOString(),
      endAt: updated.endAt.toISOString(),
      actorId: userId,
      actorName: updated.updatedBy?.fullName || updated.updatedBy?.username || null,
      attendeeIds: attendeeIds || [],
    });

    return {
      ...updated,
      attendees: updated.attendees ? updated.attendees.map((a: any) => a.user) : [],
    };
  }

  /**
   * Delete calendar event.
   */
  async deleteCalendarEvent(projectId: string, eventId: string, userId: string) {
    const { isAdmin } = await this.getMembershipAndProject(projectId, userId);

    const existing = await prisma.calendarEvent.findFirst({
      where: { id: eventId, projectId },
    });

    if (!existing) {
      throw new AppError('Calendar event not found', 404);
    }

    const isAuthor = existing.createdById === userId;
    if (!isAdmin && !isAuthor) {
      throw new AppError('You do not have permission to delete this event', 403);
    }

    await prisma.$transaction(async (tx) => {
      await tx.calendarEvent.delete({
        where: { id: eventId },
      });

      await activityService.createActivity(
        {
          projectId,
          actorId: userId,
          type: 'CALENDAR_EVENT_DELETED',
          metadata: {
            title: existing.title,
            eventType: existing.type,
          },
        },
        tx
      );
    });

    publishToProject(projectId, 'CALENDAR_EVENT_DELETED', {
      projectId,
      eventId,
      title: existing.title,
      actorId: userId,
    });

    return { success: true, message: 'Calendar event deleted successfully' };
  }
}

export const calendarService = new CalendarService();
