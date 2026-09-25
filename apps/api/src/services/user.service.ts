import prisma, { Prisma } from '../prisma.js';
import { hashPassword, verifyPassword } from '../utils/security.js';
import { AppError } from '../middlewares/error.middleware.js';
import { sessionService } from './session.service.js';
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
  isEmailVerified: boolean;
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
    isEmailVerified: !!user.isEmailVerified,
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

  // Revoke all sessions on password change for security
  await sessionService.revokeAllUserSessions(userId);

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
          projectId: true,
          title: true,
          description: true,
          type: true,
          status: true,
          priority: true,
          dueDate: true,
          createdAt: true,
        },
      },
      createdWorkItems: {
        select: {
          id: true,
          projectId: true,
          title: true,
          description: true,
          type: true,
          status: true,
          priority: true,
          dueDate: true,
          createdAt: true,
        },
      },
      uploadedAttachments: {
        select: {
          id: true,
          projectId: true,
          originalName: true,
          sizeBytes: true,
          mimeType: true,
          category: true,
          createdAt: true,
        },
      },
      createdCalendarEvents: {
        select: {
          id: true,
          projectId: true,
          title: true,
          description: true,
          startAt: true,
          endAt: true,
          allDay: true,
          location: true,
          createdAt: true,
        },
      },
      calendarAttendees: {
        include: {
          calendarEvent: {
            select: {
              id: true,
              projectId: true,
              title: true,
              startAt: true,
              endAt: true,
            },
          },
        },
      },
      sentInvitations: {
        select: {
          id: true,
          projectId: true,
          invitedEmail: true,
          role: true,
          status: true,
          createdAt: true,
          expiresAt: true,
        },
      },
      receivedInvitations: {
        select: {
          id: true,
          projectId: true,
          role: true,
          status: true,
          createdAt: true,
        },
      },
      notifications: {
        take: 100,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          readAt: true,
          createdAt: true,
        },
      },
      createdNotes: {
        select: {
          id: true,
          projectId: true,
          title: true,
          content: true,
          visibility: true,
          createdAt: true,
        },
      },
      comments: {
        select: {
          id: true,
          workItemId: true,
          body: true,
          createdAt: true,
        },
      },
      activities: {
        take: 100,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          projectId: true,
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
    createdWorkItems: user.createdWorkItems,
    uploadedFiles: user.uploadedAttachments,
    calendarEvents: {
      created: user.createdCalendarEvents,
      attending: user.calendarAttendees.map((ca) => ca.calendarEvent),
    },
    invitations: {
      sent: user.sentInvitations,
      received: user.receivedInvitations,
    },
    notes: user.createdNotes,
    comments: user.comments,
    notifications: user.notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      read: !!n.readAt,
      readAt: n.readAt,
      createdAt: n.createdAt,
    })),
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

export async function deleteUserAccount(userId: string): Promise<{ success: boolean; message: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || user.isDeactivated) {
    throw new AppError('User not found', 404);
  }

  // 1. Owner protection: verify user is not the sole administrator of any active project
  const ownedProjects = await prisma.project.findMany({
    where: { createdById: userId, status: { not: 'ARCHIVED' } },
    include: {
      members: {
        where: { role: 'PROJECT_ADMIN', userId: { not: userId } },
      },
    },
  });

  for (const project of ownedProjects) {
    if (project.members.length === 0) {
      throw new AppError(
        `Cannot delete account because you are the sole administrator of project "${project.name}". Please transfer project ownership or assign another administrator before deleting your account.`,
        400
      );
    }
  }

  const adminMemberships = await prisma.projectMember.findMany({
    where: { userId, role: 'PROJECT_ADMIN' },
    include: {
      project: {
        include: {
          members: { where: { role: 'PROJECT_ADMIN' } },
        },
      },
    },
  });

  for (const m of adminMemberships) {
    if (m.project.members.length <= 1 && m.project.status !== 'ARCHIVED') {
      throw new AppError(
        `Cannot delete account because you are the only administrator of project "${m.project.name}". Please assign another administrator before deleting your account.`,
        400
      );
    }
  }

  // 2. Atomically transfer project ownership, remove memberships, unassign work items, and soft-deactivate user in single transaction (Item 19)
  const anonymizedUsername = `deleted_user_${userId.replace(/-/g, '').slice(0, 8)}`;
  const anonymizedEmail = `deleted_${userId}@deleted.d-board.local`;

  await prisma.$transaction(async (tx) => {
    // 2a. Transfer project ownership to another administrator if user is creator
    for (const project of ownedProjects) {
      const successorAdmin = project.members[0];
      if (successorAdmin) {
        await tx.project.update({
          where: { id: project.id },
          data: { createdById: successorAdmin.userId },
        });
      }
    }

    // 2b. Unassign user from active work items
    await tx.workItem.updateMany({
      where: { assignedToId: userId },
      data: { assignedToId: null },
    });

    // 2c. Remove project memberships
    await tx.projectMember.deleteMany({
      where: { userId },
    });

    // 2d. Soft-deactivate and anonymize personal authentication info
    await tx.user.update({
      where: { id: userId },
      data: {
        fullName: 'Former Member',
        username: anonymizedUsername,
        email: anonymizedEmail,
        passwordHash: null,
        googleId: null,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        passwordResetAttempts: 0,
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
        avatarUrl: null,
        bio: null,
        headline: null,
        isEmailVerified: false,
        isDeactivated: true,
        deactivatedAt: new Date(),
        notificationPreferences: Prisma.JsonNull,
      },
    });
  });

  // 3. Post-transaction session revocation and farewell email
  await sessionService.revokeAllUserSessions(userId);

  await sendAccountDeletedEmail({
    toEmail: user.email,
    username: user.username,
  }).catch((err) => {
    console.error('[User Service]: Failed to dispatch account deleted email:', err);
  });

  return { success: true, message: 'Your account has been deactivated and your personal details have been anonymized.' };
}

export const userService = {
  getUserProfile,
  updateUserProfile,
  changeUserPassword,
  updateNotificationPreferences,
  exportUserData,
  deleteUserAccount,
};