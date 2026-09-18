import prisma from '../prisma.js';
import { hashPassword, verifyPassword } from '../utils/security.js';
import { AppError } from '../middlewares/error.middleware.js';
import {
  UpdateProfileInput,
  ChangePasswordInput,
  UpdateNotificationPreferencesInput,
} from '../schemas/user.schema.js';
import {
  sendPasswordChangedAlertEmail,
  sendDataExportCompletedEmail,
  sendAccountDeletedEmail,
} from './email.service.js';

export interface UserProfileResponse {
  id: string;
  fullName: string | null;
  username: string;
  email: string;
  avatarUrl: string | null;
  googleId: string | null;
  hasPassword: boolean;
  bio: string | null;
  headline: string | null;
  timezone: string;
  notificationPreferences: {
    emailWorkAssigned: boolean;
    emailMentions: boolean;
    emailInvitations: boolean;
    emailDueSoon: boolean;
    weeklyDigest: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_NOTIFICATION_PREFERENCES = {
  emailWorkAssigned: true,
  emailMentions: true,
  emailInvitations: true,
  emailDueSoon: true,
  weeklyDigest: true,
};

function formatProfileResponse(user: any): UserProfileResponse {
  const prefs = user.notificationPreferences
    ? { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(user.notificationPreferences as object) }
    : DEFAULT_NOTIFICATION_PREFERENCES;

  return {
    id: user.id,
    fullName: user.fullName || null,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl || null,
    googleId: user.googleId || null,
    hasPassword: !!user.passwordHash,
    bio: user.bio || null,
    headline: user.headline || null,
    timezone: user.timezone || 'UTC',
    notificationPreferences: prefs,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function getUserProfile(userId: string): Promise<UserProfileResponse> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return formatProfileResponse(user);
}

export async function updateUserProfile(
  userId: string,
  input: UpdateProfileInput
): Promise<UserProfileResponse> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Check username uniqueness if changing username
  if (input.username && input.username !== user.username) {
    const existing = await prisma.user.findFirst({
      where: {
        username: {
          equals: input.username,
          mode: 'insensitive',
        },
        NOT: { id: userId },
      },
    });

    if (existing) {
      throw new AppError('Username is already taken by another account', 409);
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      fullName: input.fullName !== undefined ? input.fullName : user.fullName,
      username: input.username || user.username,
      headline: input.headline !== undefined ? input.headline : user.headline,
      bio: input.bio !== undefined ? input.bio : user.bio,
      timezone: input.timezone || user.timezone,
      avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : user.avatarUrl,
    },
  });

  return formatProfileResponse(updatedUser);
}

export async function changeUserPassword(
  userId: string,
  input: ChangePasswordInput,
  reqMeta?: { ip?: string; userAgent?: string }
): Promise<{ success: boolean; message: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // If user has existing password, verify it
  if (user.passwordHash) {
    const isCurrentValid = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new AppError('The current password you provided is incorrect', 400);
    }
  }

  // Hash and save new password
  const newPasswordHash = await hashPassword(input.newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newPasswordHash },
  });

  // Automated Security Alert Email Dispatch
  sendPasswordChangedAlertEmail({
    toEmail: user.email,
    username: user.username,
    changedAt: new Date(),
    ipAddress: reqMeta?.ip,
    userAgent: reqMeta?.userAgent,
  }).catch((err) => {
    console.error('[User Service]: Failed to dispatch security alert email:', err);
  });

  return {
    success: true,
    message: 'Your password has been changed successfully.',
  };
}

export async function updateNotificationPreferences(
  userId: string,
  input: UpdateNotificationPreferencesInput
): Promise<UserProfileResponse['notificationPreferences']> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const currentPrefs = user.notificationPreferences
    ? { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(user.notificationPreferences as object) }
    : DEFAULT_NOTIFICATION_PREFERENCES;

  const mergedPrefs = {
    ...currentPrefs,
    ...input,
  };

  await prisma.user.update({
    where: { id: userId },
    data: {
      notificationPreferences: mergedPrefs,
    },
  });

  return mergedPrefs;
}

export async function exportUserData(userId: string): Promise<Record<string, any>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      createdProjects: {
        select: {
          id: true,
          name: true,
          key: true,
          description: true,
          status: true,
          createdAt: true,
        },
      },
      memberships: {
        include: {
          project: {
            select: {
              id: true,
              name: true,
              key: true,
            },
          },
        },
      },
      assignedWorkItems: {
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          status: true,
          priority: true,
          dueDate: true,
          createdAt: true,
        },
      },
      createdNotes: {
        select: {
          id: true,
          title: true,
          content: true,
          visibility: true,
          createdAt: true,
        },
      },
      comments: {
        select: {
          id: true,
          body: true,
          createdAt: true,
        },
      },
      activities: {
        take: 100,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const exportArchive = {
    account: {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      bio: user.bio,
      headline: user.headline,
      timezone: user.timezone,
      createdAt: user.createdAt,
    },
    createdProjects: user.createdProjects,
    projectMemberships: user.memberships.map((m) => ({
      projectId: m.projectId,
      projectName: m.project?.name,
      role: m.role,
      joinedAt: m.joinedAt,
    })),
    assignedWorkItems: user.assignedWorkItems,
    notes: user.createdNotes,
    comments: user.comments,
    recentActivities: user.activities,
    exportedAt: new Date().toISOString(),
    version: '1.0',
  };

  // Automated notification email dispatch
  sendDataExportCompletedEmail({
    toEmail: user.email,
    username: user.username,
    exportedAt: new Date(),
  }).catch((err) => {
    console.error('[User Service]: Failed to send data export email:', err);
  });

  return exportArchive;
}

export async function deleteUserAccount(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Send farewell email
  await sendAccountDeletedEmail({
    toEmail: user.email,
    username: user.username,
  }).catch((err) => {
    console.error('[User Service]: Failed to dispatch account deleted email:', err);
  });

  // Delete user account (foreign key cascades handle relations)
  await prisma.user.delete({
    where: { id: userId },
  });
}