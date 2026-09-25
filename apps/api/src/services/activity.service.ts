import { prisma } from '../prisma.js';
import { ActivityType } from '../generated/prisma/index.js';
import { AppError } from '../middlewares/error.middleware.js';

export interface CreateActivityParams {
  projectId: string;
  actorId: string;
  type: ActivityType;
  metadata?: Record<string, any>;
  workItemId?: string | null;
  noteId?: string | null;
  calendarEventId?: string | null;
  attachmentId?: string | null;
}

export class ActivityService {
  /**
   * Centralized activity creation helper. Can accept an active Prisma transaction client.
   */
  async createActivity(params: CreateActivityParams, txClient?: any) {
    const client = txClient || prisma;
    return await client.activity.create({
      data: {
        projectId: params.projectId,
        actorId: params.actorId,
        type: params.type,
        metadata: params.metadata || undefined,
        workItemId: params.workItemId || undefined,
        noteId: params.noteId || undefined,
        calendarEventId: params.calendarEventId || undefined,
        attachmentId: params.attachmentId || undefined,
      },
    });
  }

  /**
   * Get chronological project activities with actor, work item, note, calendar, and file metadata
   */
  async getProjectActivities(
    projectId: string,
    userId: string,
    filters?: {
      category?: 'all' | 'work' | 'comments' | 'members' | 'notes' | 'calendar' | 'files';
      limit?: number;
      offset?: number;
    }
  ) {
    // 1. Verify project access
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { createdById: true },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const isOwner = project.createdById === userId;
    const isMember = !!membership || isOwner;

    if (!isMember) {
      throw new AppError('You are not authorized to view this project activity', 403);
    }

    const isAdmin = isOwner || membership?.role === 'PROJECT_ADMIN';

    // 2. Build where filter
    const where: any = { projectId };

    if (filters?.category) {
      if (filters.category === 'work') {
        where.type = {
          in: [
            'WORK_CREATED',
            'WORK_ASSIGNED',
            'WORK_STATUS_CHANGED',
            'WORK_PRIORITY_CHANGED',
            'WORK_UPDATED',
            'WORK_COMPLETED',
          ],
        };
      } else if (filters.category === 'comments') {
        where.type = {
          in: ['COMMENT_ADDED', 'COMMENT_UPDATED', 'COMMENT_DELETED'],
        };
      } else if (filters.category === 'members') {
        where.type = {
          in: ['MEMBER_ADDED', 'MEMBER_REMOVED'],
        };
      } else if (filters.category === 'notes') {
        where.type = {
          in: [
            'NOTE_CREATED',
            'NOTE_UPDATED',
            'NOTE_PINNED',
            'NOTE_UNPINNED',
            'NOTE_DELETED',
            'NOTE_VISIBILITY_CHANGED',
          ],
        };
      } else if (filters.category === 'calendar') {
        where.type = {
          in: [
            'CALENDAR_EVENT_CREATED',
            'CALENDAR_EVENT_UPDATED',
            'CALENDAR_EVENT_DELETED',
          ],
        };
      } else if (filters.category === 'files') {
        where.type = {
          in: ['FILE_UPLOADED', 'FILE_RENAMED', 'FILE_DELETED'],
        };
      }
    }

    // 3. Security: Filter out private note activities for non-admins and non-recipients
    if (!isAdmin) {
      // Find IDs of notes where user is mentioned or is author
      const accessiblePrivateNotes = await prisma.note.findMany({
        where: {
          projectId,
          visibility: 'USERS',
          OR: [
            { createdById: userId },
            { mentions: { some: { userId } } },
          ],
        },
        select: { id: true },
      });
      const accessibleNoteIdSet = new Set(accessiblePrivateNotes.map((n) => n.id));

      const noteTypes: ActivityType[] = [
        'NOTE_CREATED',
        'NOTE_UPDATED',
        'NOTE_PINNED',
        'NOTE_UNPINNED',
        'NOTE_DELETED',
        'NOTE_VISIBILITY_CHANGED',
      ];

      // Exclude note activities that have USERS visibility if user is not author or recipient
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            // Non-note activities
            { type: { notIn: noteTypes } },
            // Public note activities or private ones the user has access to
            {
              type: { in: noteTypes },
              OR: [
                { note: { visibility: 'TEAM' } },
                { noteId: { in: Array.from(accessibleNoteIdSet) } },
                { actorId: userId },
              ],
            },
          ],
        },
      ];
    }

    const limit = Math.min(filters?.limit || 50, 100);
    const offset = filters?.offset || 0;

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        include: {
          actor: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          workItem: {
            select: { id: true, title: true, type: true, status: true, priority: true },
          },
          note: {
            select: { id: true, title: true, visibility: true },
          },
          calendarEvent: {
            select: { id: true, title: true, type: true, startAt: true, endAt: true, allDay: true },
          },
          attachment: {
            select: { id: true, originalName: true, category: true, sizeBytes: true, extension: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.activity.count({ where }),
    ]);

    return {
      activities,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get chronological global activities across all projects the user has access to
   */
  async getGlobalActivities(
    userId: string,
    filters?: {
      category?: 'all' | 'work' | 'comments' | 'members' | 'notes' | 'calendar' | 'files';
      limit?: number;
      offset?: number;
    }
  ) {
    // 1. Find all projects accessible to the user
    const userProjects = await prisma.project.findMany({
      where: {
        OR: [
          { createdById: userId },
          { members: { some: { userId } } },
        ],
      },
      select: { id: true, createdById: true },
    });

    if (userProjects.length === 0) {
      return {
        activities: [],
        total: 0,
        limit: Math.min(filters?.limit || 50, 100),
        offset: filters?.offset || 0,
      };
    }

    const projectIds = userProjects.map((p) => p.id);
    const ownedProjectIds = new Set(userProjects.filter((p) => p.createdById === userId).map((p) => p.id));

    // 2. Build where filter
    const where: any = {
      projectId: { in: projectIds },
    };

    if (filters?.category) {
      if (filters.category === 'work') {
        where.type = {
          in: [
            'WORK_CREATED',
            'WORK_ASSIGNED',
            'WORK_STATUS_CHANGED',
            'WORK_PRIORITY_CHANGED',
            'WORK_UPDATED',
            'WORK_COMPLETED',
          ],
        };
      } else if (filters.category === 'comments') {
        where.type = {
          in: ['COMMENT_ADDED', 'COMMENT_UPDATED', 'COMMENT_DELETED'],
        };
      } else if (filters.category === 'members') {
        where.type = {
          in: ['MEMBER_ADDED', 'MEMBER_REMOVED'],
        };
      } else if (filters.category === 'notes') {
        where.type = {
          in: [
            'NOTE_CREATED',
            'NOTE_UPDATED',
            'NOTE_PINNED',
            'NOTE_UNPINNED',
            'NOTE_DELETED',
            'NOTE_VISIBILITY_CHANGED',
          ],
        };
      } else if (filters.category === 'calendar') {
        where.type = {
          in: [
            'CALENDAR_EVENT_CREATED',
            'CALENDAR_EVENT_UPDATED',
            'CALENDAR_EVENT_DELETED',
          ],
        };
      } else if (filters.category === 'files') {
        where.type = {
          in: ['FILE_UPLOADED', 'FILE_RENAMED', 'FILE_DELETED'],
        };
      }
    }

    // 3. Filter out private notes across projects where user is not owner/author/mentioned
    const accessiblePrivateNotes = await prisma.note.findMany({
      where: {
        projectId: { in: projectIds },
        visibility: 'USERS',
        OR: [
          { createdById: userId },
          { mentions: { some: { userId } } },
        ],
      },
      select: { id: true },
    });
    const accessibleNoteIdSet = new Set(accessiblePrivateNotes.map((n) => n.id));

    const noteTypes: ActivityType[] = [
      'NOTE_CREATED',
      'NOTE_UPDATED',
      'NOTE_PINNED',
      'NOTE_UNPINNED',
      'NOTE_DELETED',
      'NOTE_VISIBILITY_CHANGED',
    ];

    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          // Non-note activities
          { type: { notIn: noteTypes } },
          // Public note activities, private notes user has access to, or projects user owns
          {
            type: { in: noteTypes },
            OR: [
              { note: { visibility: 'TEAM' } },
              { noteId: { in: Array.from(accessibleNoteIdSet) } },
              { actorId: userId },
              { projectId: { in: Array.from(ownedProjectIds) } },
            ],
          },
        ],
      },
    ];

    const limit = Math.min(filters?.limit || 50, 100);
    const offset = filters?.offset || 0;

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        include: {
          project: {
            select: { id: true, name: true, key: true },
          },
          actor: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          workItem: {
            select: { id: true, title: true, type: true, status: true, priority: true },
          },
          note: {
            select: { id: true, title: true, visibility: true },
          },
          calendarEvent: {
            select: { id: true, title: true, type: true, startAt: true, endAt: true, allDay: true },
          },
          attachment: {
            select: { id: true, originalName: true, category: true, sizeBytes: true, extension: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.activity.count({ where }),
    ]);

    return {
      activities,
      total,
      limit,
      offset,
    };
  }
}

export const activityService = new ActivityService();
