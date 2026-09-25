import crypto from 'crypto';
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
      select: { id: true, name: true, createdById: true, status: true },
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
   * Helper to validate attendee authorization:
   * Every attendee must exist, be active (not deactivated), and be an active member of this project.
   */
  private async validateAttendees(projectId: string, attendeeIds: string[]) {
    if (!attendeeIds || attendeeIds.length === 0) return;

    const uniqueAttendeeIds = Array.from(new Set(attendeeIds));

    // Fetch the project to check creator/owner
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { createdById: true },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    // Fetch memberships for these attendees in this specific project
    const members = await prisma.projectMember.findMany({
      where: {
        projectId,
        userId: { in: uniqueAttendeeIds },
      },
      include: {
        user: {
          select: { id: true, isDeactivated: true },
        },
      },
    });

    const validMemberUserIds = new Set<string>();
    for (const m of members) {
      if (!m.user.isDeactivated) {
        validMemberUserIds.add(m.userId);
      }
    }

    // Check project creator/owner if included
    if (uniqueAttendeeIds.includes(project.createdById)) {
      const owner = await prisma.user.findUnique({
        where: { id: project.createdById },
        select: { id: true, isDeactivated: true },
      });
      if (owner && !owner.isDeactivated) {
        validMemberUserIds.add(owner.id);
      }
    }

    for (const aId of uniqueAttendeeIds) {
      if (!validMemberUserIds.has(aId)) {
        throw new AppError(
          `Attendee ${aId} is not an active member of this project or the account is deactivated`,
          400
        );
      }
    }
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
    const { project } = await this.getMembershipAndProject(projectId, userId);

    if (project.status === 'ARCHIVED') {
      throw new AppError('Cannot create calendar events in an archived project', 400);
    }

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

    // Validate that all attendees exist, are active, and belong to this project
    await this.validateAttendees(projectId, attendeeIds);

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
    const { isAdmin, project } = await this.getMembershipAndProject(projectId, userId);

    if (project.status === 'ARCHIVED') {
      throw new AppError('Cannot modify calendar events in an archived project', 400);
    }

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
    if (attendeeIds !== undefined) {
      await this.validateAttendees(projectId, attendeeIds);
    }

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
    const { isAdmin, project } = await this.getMembershipAndProject(projectId, userId);

    if (project.status === 'ARCHIVED') {
      throw new AppError('Cannot delete calendar events in an archived project', 400);
    }

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

  /**
   * Generate RFC 5545 iCalendar stream (.ics) for authenticated user's calendar items.
   */
  async generateICalFeed(userId: string, projectId?: string): Promise<string> {
    const calendarData = await this.getCalendarItems(userId, {
      projectId,
      type: 'ALL',
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//D-Board//Workspace Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:D-Board Calendar',
      'X-WR-TIMEZONE:UTC',
    ];

    for (const item of calendarData.items) {
      const start = new Date(item.startAt)
        .toISOString()
        .replace(/[-:]/g, '')
        .split('.')[0] + 'Z';
      const end = new Date(item.endAt)
        .toISOString()
        .replace(/[-:]/g, '')
        .split('.')[0] + 'Z';
      const summary = (item.title || 'Event')
        .replace(/\\/g, '\\\\')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;')
        .replace(/\n/g, '\\n');
      const desc = (item.description || (item.project?.name ? `Project: ${item.project.name}` : 'D-Board item'))
        .replace(/\\/g, '\\\\')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;')
        .replace(/\n/g, '\\n');
      const location = (item.location || 'D-Board Workspace')
        .replace(/\\/g, '\\\\')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;');

      lines.push(
        'BEGIN:VEVENT',
        `UID:${item.id}@dboard.workspace`,
        `DTSTAMP:${start}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${desc}`,
        `LOCATION:${location}`,
        'STATUS:CONFIRMED',
        'END:VEVENT'
      );
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  /**
   * Create or rotate a high-entropy revocable calendar feed subscription token.
   * Cryptographically generated with 256-bit entropy. Raw token is never stored in DB.
   */
  async createFeedToken(userId: string, projectId?: string | null): Promise<{ token: string; createdAt: Date }> {
    if (projectId) {
      await this.getMembershipAndProject(projectId, userId);
    }

    const rawToken = `dbcal_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Revoke previous active tokens for this user & project scope to enforce rotation
    await prisma.calendarFeedToken.updateMany({
      where: {
        userId,
        projectId: projectId || null,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    // Store only tokenHash (never rawToken)
    await prisma.calendarFeedToken.create({
      data: {
        tokenHash,
        userId,
        projectId: projectId || null,
      },
    });

    return { token: rawToken, createdAt: new Date() };
  }

  /**
   * Revoke existing calendar feed subscription token.
   */
  async revokeFeedToken(userId: string, projectId?: string | null): Promise<{ success: boolean; message: string }> {
    if (projectId) {
      await this.getMembershipAndProject(projectId, userId);
    }

    await prisma.calendarFeedToken.updateMany({
      where: {
        userId,
        projectId: projectId || null,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { success: true, message: 'Calendar feed token revoked successfully' };
  }

  /**
   * Validate a calendar feed token from request query.
   * Strict security checks:
   * - Computes SHA-256 hash
   * - Token must exist and not be revoked
   * - User must not be deactivated
   * - If projectId expected: token.projectId MUST match expected projectId (no cross-project leakage)
   * - User must currently be an active member or owner of the project
   */
  async authenticateFeedToken(rawToken: string, expectedProjectId?: string): Promise<{ userId: string; projectId?: string | null }> {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new AppError('Calendar feed subscription token required', 401);
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

    const feedToken = await prisma.calendarFeedToken.findUnique({
      where: { tokenHash },
      include: {
        user: { select: { id: true, isDeactivated: true } },
      },
    });

    if (!feedToken || feedToken.revokedAt || feedToken.user.isDeactivated) {
      throw new AppError('Invalid or expired calendar feed token', 401);
    }

    if (expectedProjectId) {
      if (feedToken.projectId !== expectedProjectId) {
        throw new AppError('Calendar feed token is not authorized for this project', 403);
      }

      // Verify that user is still an active member of this project
      const project = await prisma.project.findUnique({
        where: { id: expectedProjectId },
        select: { createdById: true },
      });

      const isOwner = project?.createdById === feedToken.userId;
      const membership = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: expectedProjectId,
            userId: feedToken.userId,
          },
        },
      });

      if (!isOwner && !membership) {
        throw new AppError('User is no longer an active member of this project', 403);
      }
    }

    // Touch lastUsedAt asynchronously
    prisma.calendarFeedToken.update({
      where: { id: feedToken.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    return { userId: feedToken.userId, projectId: feedToken.projectId };
  }
}

export const calendarService = new CalendarService();
