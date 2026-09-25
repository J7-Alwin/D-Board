export const QUEUE_NAMES = {
  EMAIL: 'dboard-email',
  DEADLINES: 'dboard-deadlines',
  CLEANUP: 'dboard-cleanup',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

export type EmailJobType = 'PASSWORD_RESET' | 'PROJECT_INVITATION';

export interface PasswordResetEmailJobData {
  type: 'PASSWORD_RESET';
  toEmail: string;
  username: string;
  resetToken: string;
}

export interface InvitationEmailJobData {
  type: 'PROJECT_INVITATION';
  toEmail: string;
  inviterName: string;
  projectName: string;
  projectKey?: string | null;
  role: string;
  message?: string | null;
  expiresAt: string; // ISO String
}

export type EmailJobData = PasswordResetEmailJobData | InvitationEmailJobData;

export interface DeadlineReminderJobData {
  workItemId: string;
  projectId: string;
  title: string;
  dueDate: string; // ISO String
  assignedToId: string;
  reminderType: 'DEADLINE_SOON' | 'DEADLINE_OVERDUE';
}

export interface OrphanStorageCleanupJobData {
  type: 'ORPHAN_STORAGE_CLEANUP';
  storageKey: string;
}

export type CleanupJobData =
  | { type: 'EXPIRED_INVITATIONS' }
  | { type: 'EXPIRED_RESET_TOKENS' }
  | { type: 'EXPIRED_NOTIFICATIONS' }
  | OrphanStorageCleanupJobData;
