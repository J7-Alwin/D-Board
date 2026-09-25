export type RealtimeEventType =
  // Work Item Events
  | 'WORK_CREATED'
  | 'WORK_UPDATED'
  | 'WORK_ASSIGNED'
  | 'WORK_STATUS_CHANGED'
  | 'WORK_COMPLETED'
  | 'WORK_DELETED'
  // Comment Events
  | 'COMMENT_CREATED'
  | 'COMMENT_UPDATED'
  | 'COMMENT_DELETED'
  // Note Events
  | 'NOTE_CREATED'
  | 'NOTE_UPDATED'
  | 'NOTE_DELETED'
  | 'NOTE_PINNED'
  | 'NOTE_UNPINNED'
  // Calendar Events
  | 'CALENDAR_EVENT_CREATED'
  | 'CALENDAR_EVENT_UPDATED'
  | 'CALENDAR_EVENT_DELETED'
  // File Events
  | 'FILE_UPLOADED'
  | 'FILE_RENAMED'
  | 'FILE_DELETED'
  | 'FILE_MOVED'
  | 'FOLDER_CREATED'
  | 'FOLDER_RENAMED'
  | 'FOLDER_DELETED'
  // Member Events
  | 'MEMBER_ADDED'
  | 'MEMBER_REMOVED'
  | 'MEMBER_ROLE_CHANGED'
  // Invitation Events
  | 'INVITATION_CREATED'
  | 'INVITATION_ACCEPTED'
  | 'INVITATION_DECLINED'
  // Activity Events
  | 'ACTIVITY_CREATED'
  // Notification Events
  | 'NOTIFICATION_CREATED'
  | 'NOTIFICATION_READ'
  | 'NOTIFICATION_DELETED';

export interface BaseRealtimePayload {
  eventId?: string;
  timestamp?: string;
  actorId?: string | null;
  actorName?: string | null;
}

export interface WorkItemRealtimePayload extends BaseRealtimePayload {
  projectId: string;
  workItemId: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  assignedToId?: string | null;
  fromStatus?: string;
  toStatus?: string;
}

export interface CommentRealtimePayload extends BaseRealtimePayload {
  projectId: string;
  workItemId: string;
  commentId: string;
  preview: string;
}

export interface NoteRealtimePayload extends BaseRealtimePayload {
  projectId: string;
  noteId: string;
  title?: string;
  visibility: 'TEAM' | 'USERS';
  pinned?: boolean;
}

export interface CalendarRealtimePayload extends BaseRealtimePayload {
  projectId: string;
  eventId: string;
  title: string;
  type: string;
  startAt: string;
  endAt: string;
}

export interface FileRealtimePayload extends BaseRealtimePayload {
  projectId: string;
  fileId: string;
  originalName: string;
  category: string;
  sizeBytes?: number;
  workItemId?: string | null;
}

export interface NotificationRealtimePayload extends BaseRealtimePayload {
  recipientId: string;
  notificationId: string;
  type: string;
  title: string;
  message: string;
  link: string;
  unreadCount?: number;
}
