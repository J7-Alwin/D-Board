import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(60, 'Full name must not exceed 60 characters')
    .optional(),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must not exceed 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .max(100, 'Email must not exceed 100 characters'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must not exceed 100 characters'),
  termsAccepted: z
    .boolean()
    .optional(),
  avatarUrl: z
    .string()
    .optional()
    .nullable(),
});

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, 'Username or email is required'),
  password: z
    .string()
    .min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Invalid email address'),
});

export const verifyOtpSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Invalid email address'),
  otp: z
    .string()
    .trim()
    .min(6, 'Verification code must be 6 digits')
    .max(6, 'Verification code must be 6 digits'),
});

export const resetPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .optional(),
  otp: z
    .string()
    .trim()
    .min(6, 'Verification code must be 6 digits')
    .max(6, 'Verification code must be 6 digits')
    .optional(),
  token: z
    .string()
    .trim()
    .optional(),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must not exceed 100 characters'),
}).refine((data) => (data.otp && data.email) || data.token, {
  message: 'Either 6-digit OTP with email or reset token must be provided',
});

export const verifyEmailSchema = z.object({
  token: z.string().trim().min(1, 'Verification token is required'),
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
});

export const updateUsernameSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must not exceed 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type UpdateUsernameInput = z.infer<typeof updateUsernameSchema>;
