import { prisma } from '../prisma.js';
import { NotificationType, Prisma } from '../generated/prisma/index.js';
import { AppError } from '../middlewares/error.middleware.js';
import { publishToUser } from '../realtime/realtime.service.js';
import { sendWorkItemAssignedEmail } from './email.service.js';

export interface CreateNotificationInput {
  recipientId: string;
  actorId?: string | null;
  projectId?: string | null;
  workItemId?: string | null;
  commentId?: string | null;
  noteId?: string | null;
  activityId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  link: string;
}

export interface GetNotificationsParams {
  category?: 'ALL' | 'UNREAD' | 'MENTIONS' | 'ASSIGNMENTS' | 'COMMENTS' | 'INVITATIONS' | 'EVENTS' | 'SYSTEM';
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
}

export class NotificationService {
  /**
   * Create a single targeted notification with actor exclusion and deduplication.
   */
  async createNotification(input: CreateNotificationInput, txClient?: any) {
    // 1. Actor exclusion: A user is never notified about their own action
    if (input.actorId && input.recipientId === input.actorId) {
      return null;
    }

    const client = txClient || prisma;

    // 2. Idempotency / Duplicate Check
    const existing = await client.notification.findFirst({
      where: {
        recipientId: input.recipientId,
        type: input.type,
        projectId: input.projectId || null,
        workItemId: input.workItemId || null,
        commentId: input.commentId || null,
        noteId: input.noteId || null,
        activityId: input.activityId || null,
        readAt: null, // If already unread, don't duplicate
      },
    });

    if (existing) {
      return existing;
    }

    // 3. Create Notification
    const created = await client.notification.create({
      data: {
        recipientId: input.recipientId,
        actorId: input.actorId || undefined,
        projectId: input.projectId || undefined,
        workItemId: input.workItemId || undefined,
        commentId: input.commentId || undefined,
        noteId: input.noteId || undefined,
        activityId: input.activityId || undefined,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link,
      },
      include: {
        actor: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatarUrl: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            key: true,
          },
        },
      },
    });

    publishToUser(created.recipientId, 'NOTIFICATION_CREATED', {
      recipientId: created.recipientId,
      notificationId: created.id,
      type: created.type,
      title: created.title,
      message: created.message,
      link: created.link,
      actorId: created.actorId,
      actorName: created.actor?.fullName || created.actor?.username || null,
    });

    // Automated Email Dispatch based on user notification preferences
    if (created.type === 'WORK_ASSIGNED') {
      (async () => {
        try {
          const recipient = await prisma.user.findUnique({
            where: { id: created.recipientId },
            select: { email: true, username: true, fullName: true, notificationPreferences: true },
          });
          const prefs = recipient?.notificationPreferences as any;
          if (recipient && (!prefs || prefs.emailWorkAssigned !== false)) {
            await sendWorkItemAssignedEmail({
              toEmail: recipient.email,
              assigneeName: recipient.fullName || recipient.username,
              assignerName: created.actor?.fullName || created.actor?.username || 'Team Member',
              workItemTitle: created.title,
              workItemType: 'Work Item',
              projectName: created.project?.name || 'Workspace',
              link: created.link ? `${process.env.APP_URL || 'http://localhost:5173'}${created.link}` : undefined,
            });
          }
        } catch (e) {
          console.error('[NotificationService]: Error dispatching work assignment email:', e);
        }
      })();
    }

    return created;
  }

  /**
   * Bulk notification creation for multi-recipient events (e.g., @team, multi-mentions).
   */
  async createBulkNotifications(inputs: CreateNotificationInput[], txClient?: any) {
    const client = txClient || prisma;
    const created = [];
    const seenRecipients = new Set<string>();

    for (const input of inputs) {
      // Exclude actor and deduplicate within batch
      if (input.actorId && input.recipientId === input.actorId) continue;
      const key = `${input.recipientId}_${input.type}_${input.workItemId || ''}_${input.noteId || ''}_${input.commentId || ''}`;
      if (seenRecipients.has(key)) continue;
      seenRecipients.add(key);

      const notif = await this.createNotification(input, client);
      if (notif) created.push(notif);
    }

    return created;
  }

  /**
   * Fetch paginated notifications for the authenticated recipient.
   */
  async getUserNotifications(userId: string, params: GetNotificationsParams = {}) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Auto-purge expired notifications older than 7 days from the database
    prisma.notification.deleteMany({
      where: { createdAt: { lt: sevenDaysAgo } },
    }).catch((err) => console.error('[NotificationService] 7-day auto-purge failed:', err));

    // Strict IDOR protection: Always filter by recipientId & 7-day window
    const where: Prisma.NotificationWhereInput = {
      recipientId: userId,
      createdAt: { gte: sevenDaysAgo },
    };

    if (params.unreadOnly || params.category === 'UNREAD') {
      where.readAt = null;
    }

    if (params.category && params.category !== 'ALL' && params.category !== 'UNREAD') {
      switch (params.category) {
        case 'MENTIONS':
          where.type = {
            in: ['WORK_MENTIONED', 'NOTE_MENTIONED', 'NOTE_TEAM_UPDATED'],
          };
          break;
        case 'ASSIGNMENTS':
          where.type = {
            in: ['WORK_ASSIGNED', 'DEADLINE_SOON', 'DEADLINE_OVERDUE', 'WORK_STATUS_CHANGED', 'WORK_COMPLETED'],
          };
          break;
        case 'COMMENTS':
          where.type = {
            in: ['WORK_COMMENTED'],
          };
          break;
        case 'INVITATIONS':
          where.type = {
            in: ['PROJECT_INVITED', 'INVITATION_ACCEPTED', 'INVITATION_DECLINED', 'MEMBER_ADDED', 'MEMBER_REMOVED'],
          };
          break;
        case 'EVENTS':
          where.type = {
            in: ['CALENDAR_EVENT_CREATED', 'CALENDAR_EVENT_UPDATED'],
          };
          break;
        case 'SYSTEM':
          where.type = {
            in: ['SYSTEM', 'PROJECT_UPDATED', 'FILE_SHARED', 'FILE_UPLOADED'],
          };
          break;
      }
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          actor: {
            select: {
              id: true,
              fullName: true,
              username: true,
              avatarUrl: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              key: true,
              avatarUrl: true,
            },
          },
          workItem: {
            select: {
              id: true,
              title: true,
              type: true,
              status: true,
              priority: true,
            },
          },
          note: {
            select: {
              id: true,
              title: true,
              visibility: true,
            },
          },
        },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: {
          recipientId: userId,
          readAt: null,
          createdAt: { gte: sevenDaysAgo },
        },
      }),
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        unreadCount,
      },
    };
  }

  /**
   * Fast unread notification count query (7-day window).
   */
  async getUnreadCount(userId: string): Promise<number> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return await prisma.notification.count({
      where: {
        recipientId: userId,
        readAt: null,
        createdAt: { gte: sevenDaysAgo },
      },
    });
  }

  /**
   * Sweep and delete all notifications older than 7 days from the database.
   */
  async cleanupExpiredNotifications(): Promise<number> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const res = await prisma.notification.deleteMany({
      where: { createdAt: { lt: sevenDaysAgo } },
    });
    return res.count;
  }

  /**
   * Mark a single notification as read (with IDOR protection).
   */
  async markAsRead(notificationId: string, userId: string) {
    const notif = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notif) {
      throw new AppError('Notification not found', 404);
    }

    // IDOR Protection
    if (notif.recipientId !== userId) {
      throw new AppError('You are not authorized to update this notification', 403);
    }

    if (notif.readAt) {
      return notif; // Already read
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });

    publishToUser(userId, 'NOTIFICATION_READ', {
      notificationId,
      recipientId: userId,
    });

    return updated;
  }

  /**
   * Mark all unread notifications as read for the user.
   */
  async markAllAsRead(userId: string, category?: string) {
    const where: Prisma.NotificationWhereInput = {
      recipientId: userId,
      readAt: null,
    };

    if (category && category !== 'ALL') {
      if (category === 'MENTIONS') {
        where.type = { in: ['WORK_MENTIONED', 'NOTE_MENTIONED', 'NOTE_TEAM_UPDATED'] };
      } else if (category === 'ASSIGNMENTS') {
        where.type = { in: ['WORK_ASSIGNED', 'DEADLINE_SOON', 'DEADLINE_OVERDUE', 'WORK_STATUS_CHANGED', 'WORK_COMPLETED'] };
      } else if (category === 'COMMENTS') {
        where.type = { in: ['WORK_COMMENTED'] };
      } else if (category === 'INVITATIONS') {
        where.type = { in: ['PROJECT_INVITED', 'INVITATION_ACCEPTED', 'INVITATION_DECLINED', 'MEMBER_ADDED', 'MEMBER_REMOVED'] };
      } else if (category === 'EVENTS') {
        where.type = { in: ['CALENDAR_EVENT_CREATED', 'CALENDAR_EVENT_UPDATED'] };
      } else if (category === 'SYSTEM') {
        where.type = { in: ['SYSTEM', 'PROJECT_UPDATED', 'FILE_SHARED', 'FILE_UPLOADED'] };
      }
    }

    const res = await prisma.notification.updateMany({
      where,
      data: { readAt: new Date() },
    });

    publishToUser(userId, 'NOTIFICATION_READ', {
      recipientId: userId,
      all: true,
      category,
    });

    return { updatedCount: res.count };
  }

  /**
   * Delete a notification (with IDOR protection).
   */
  async deleteNotification(notificationId: string, userId: string) {
    const notif = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notif) {
      throw new AppError('Notification not found', 404);
    }

    if (notif.recipientId !== userId) {
      throw new AppError('You are not authorized to delete this notification', 403);
    }

    await prisma.notification.delete({
      where: { id: notificationId },
    });

    publishToUser(userId, 'NOTIFICATION_DELETED', {
      notificationId,
      recipientId: userId,
    });

    return { success: true };
  }
}

export const notificationService = new NotificationService();
