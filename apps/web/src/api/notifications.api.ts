import { apiClient } from './client';

export type NotificationType =
  | 'WORK_ASSIGNED'
  | 'WORK_COMMENTED'
  | 'WORK_MENTIONED'
  | 'WORK_STATUS_CHANGED'
  | 'WORK_COMPLETED'
  | 'PROJECT_INVITED'
  | 'INVITATION_ACCEPTED'
  | 'INVITATION_DECLINED'
  | 'MEMBER_ADDED'
  | 'MEMBER_REMOVED'
  | 'NOTE_MENTIONED'
  | 'NOTE_TEAM_UPDATED'
  | 'CALENDAR_EVENT_CREATED'
  | 'CALENDAR_EVENT_UPDATED'
  | 'FILE_SHARED'
  | 'FILE_UPLOADED'
  | 'PROJECT_UPDATED'
  | 'DEADLINE_SOON'
  | 'DEADLINE_OVERDUE'
  | 'SYSTEM';

export type NotificationCategory =
  | 'ALL'
  | 'UNREAD'
  | 'MENTIONS'
  | 'ASSIGNMENTS'
  | 'COMMENTS'
  | 'INVITATIONS'
  | 'EVENTS'
  | 'SYSTEM';

export interface NotificationActor {
  id: string;
  fullName: string | null;
  username: string;
  avatarUrl: string | null;
}

export interface NotificationProject {
  id: string;
  name: string;
  key: string | null;
  avatarUrl?: string | null;
}

export interface NotificationWorkItem {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
}

export interface NotificationNote {
  id: string;
  title: string;
  visibility: string;
}

export interface NotificationItem {
  id: string;
  recipientId: string;
  actorId: string | null;
  projectId: string | null;
  workItemId: string | null;
  commentId: string | null;
  noteId: string | null;
  activityId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  link: string;
  readAt: string | null;
  createdAt: string;
  actor?: NotificationActor | null;
  project?: NotificationProject | null;
  workItem?: NotificationWorkItem | null;
  note?: NotificationNote | null;
}

export interface NotificationListResponse {
  notifications: NotificationItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    unreadCount: number;
  };
}

export interface NotificationQueryParams {
  category?: NotificationCategory;
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
}

export const notificationsApi = {
  /**
   * Get paginated notifications for current user with category filtering.
   */
  async getNotifications(params: NotificationQueryParams = {}): Promise<{ success: boolean; data: NotificationListResponse }> {
    const query = new URLSearchParams();
    if (params.category && params.category !== 'ALL') query.append('category', params.category);
    if (params.unreadOnly) query.append('unreadOnly', 'true');
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());

    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient<{ success: boolean; data: NotificationListResponse }>(`/notifications${qs}`);
  },

  /**
   * Get unread notification count.
   */
  async getUnreadCount(): Promise<{ success: boolean; data: { count: number } }> {
    return apiClient<{ success: boolean; data: { count: number } }>('/notifications/unread-count');
  },

  /**
   * Mark a single notification as read.
   */
  async markAsRead(notificationId: string): Promise<{ success: boolean; data: { notification: NotificationItem } }> {
    return apiClient<{ success: boolean; data: { notification: NotificationItem } }>(`/notifications/${notificationId}/read`, {
      method: 'POST',
    });
  },

  /**
   * Mark all unread notifications as read.
   */
  async markAllAsRead(category?: NotificationCategory): Promise<{ success: boolean; message: string; data: { updatedCount: number } }> {
    return apiClient<{ success: boolean; message: string; data: { updatedCount: number } }>('/notifications/read-all', {
      method: 'POST',
      body: JSON.stringify({ category }),
    });
  },

  /**
   * Delete a notification.
   */
  async deleteNotification(notificationId: string): Promise<{ success: boolean; message: string }> {
    return apiClient<{ success: boolean; message: string }>(`/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  },
};
