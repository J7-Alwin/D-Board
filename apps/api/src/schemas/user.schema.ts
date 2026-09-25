import { z } from 'zod';

export const updateProfileSchema = z.object({
  fullName: z.string().max(100).nullable().optional(),
  username: z
    .string()
    .min(2, 'Username must be at least 2 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores')
    .optional(),
  headline: z.string().max(120).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  timezone: z.string().max(50).optional(),
  avatarUrl: z.string().max(2048, 'Avatar URL cannot exceed 2048 characters').nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New passwords do not match',
    path: ['confirmPassword'],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateNotificationPreferencesSchema = z.object({
  emailWorkAssigned: z.boolean().default(true),
  emailMentions: z.boolean().default(true),
  emailInvitations: z.boolean().default(true),
  emailDueSoon: z.boolean().default(true),
  weeklyDigest: z.boolean().default(true),
});

export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>;

export const deleteAccountSchema = z.object({
  confirmationPhrase: z.string().refine((val) => val === 'DELETE', {
    message: 'Please type DELETE to confirm account deletion',
  }),
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
