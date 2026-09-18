import crypto from 'crypto';
import prisma from '../prisma.js';
import {
  hashPassword,
  verifyPassword,
  generateSecureToken,
  hashToken,
  generateJwt,
  JwtPayload,
} from '../utils/security.js';
import { RegisterInput, LoginInput } from '../schemas/auth.schema.js';
import { AppError } from '../middlewares/error.middleware.js';
import { sendWelcomeEmail, sendPasswordResetOtpEmail } from './email.service.js';
import { invitationService } from './invitation.service.js';

export interface PublicUser {
  id: string;
  fullName: string | null;
  username: string;
  email: string;
  avatarUrl: string | null;
  isEmailVerified: boolean;
  termsAccepted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function sanitizeUser(user: any): PublicUser {
  return {
    id: user.id,
    fullName: user.fullName ?? null,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    isEmailVerified: user.isEmailVerified,
    termsAccepted: user.termsAccepted ?? true,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function register(input: RegisterInput): Promise<{ user: PublicUser; token: string }> {
  const normalizedUsername = input.username.trim().toLowerCase();
  const normalizedEmail = input.email.toLowerCase().trim();

  // Check for duplicate username (case-insensitive)
  const existingUsername = await prisma.user.findFirst({
    where: { username: { equals: normalizedUsername, mode: 'insensitive' } },
  });
  if (existingUsername) {
    const error: AppError = new Error('Username is already taken');
    error.statusCode = 409;
    error.errors = { username: ['This username is already in use'] };
    throw error;
  }

  // Check for duplicate email
  const existingEmail = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existingEmail) {
    const error: AppError = new Error('Email address is already registered');
    error.statusCode = 409;
    error.errors = { email: ['This email address is already registered'] };
    throw error;
  }

  const passwordHash = await hashPassword(input.password);

  const newUser = await prisma.user.create({
    data: {
      fullName: input.fullName?.trim() || null,
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      avatarUrl: input.avatarUrl || null,
      termsAccepted: input.termsAccepted ?? true,
      isEmailVerified: false,
    },
  });

  // Link any pending project invitations for this email address
  await invitationService.linkPendingInvitationsForUser(newUser.email, newUser.id);

  // Send Welcome onboarding email asynchronously
  sendWelcomeEmail({
    toEmail: newUser.email,
    username: newUser.username,
    fullName: newUser.fullName,
  }).catch((err) => console.error('[AuthService] Welcome email dispatch failed:', err));

  const tokenPayload: JwtPayload = {
    userId: newUser.id,
    email: newUser.email,
    username: newUser.username,
  };

  const token = generateJwt(tokenPayload);

  return {
    user: sanitizeUser(newUser),
    token,
  };
}

export async function login(input: LoginInput): Promise<{ user: PublicUser; token: string }> {
  const isEmail = input.identifier.includes('@');
  
  const user = await prisma.user.findFirst({
    where: isEmail
      ? { email: input.identifier.toLowerCase().trim() }
      : { username: input.identifier },
  });

  if (!user || !user.passwordHash) {
    const error: AppError = new Error('Invalid username/email or password');
    error.statusCode = 401;
    throw error;
  }

  const isPasswordValid = await verifyPassword(input.password, user.passwordHash);
  if (!isPasswordValid) {
    const error: AppError = new Error('Invalid username/email or password');
    error.statusCode = 401;
    throw error;
  }

  // Link any pending invitations in case user had invites created while offline
  await invitationService.linkPendingInvitationsForUser(user.email, user.id);

  const tokenPayload: JwtPayload = {
    userId: user.id,
    email: user.email,
    username: user.username,
  };

  const token = generateJwt(tokenPayload);

  return {
    user: sanitizeUser(user),
    token,
  };
}

export async function getUserById(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    const error: AppError = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return sanitizeUser(user);
}

/**
 * Request a 6-digit OTP for password recovery
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean; otp?: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    // Return success silently to prevent user enumeration
    return { success: true };
  }

  // Generate a cryptographically secure 6-digit numeric OTP
  const otp = crypto.randomInt(100000, 999999).toString();
  const hashedOtp = hashToken(otp);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiration

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: hashedOtp,
      passwordResetExpiresAt: expiresAt,
    },
  });

  // Dispatch OTP email
  sendPasswordResetOtpEmail({
    toEmail: user.email,
    username: user.fullName || user.username,
    otp,
  }).catch((err) => console.error('[AuthService] Password reset OTP email failed:', err));

  return { success: true, otp };
}

/**
 * Pre-verify 6-digit OTP code before setting new password
 */
export async function verifyPasswordResetOtp(email: string, otp: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  const cleanOtp = otp.trim();
  const hashedOtp = hashToken(cleanOtp);

  const user = await prisma.user.findFirst({
    where: {
      email: normalizedEmail,
      passwordResetTokenHash: hashedOtp,
      passwordResetExpiresAt: {
        gt: new Date(),
      },
    },
  });

  if (!user) {
    const error: AppError = new Error('Invalid or expired 6-digit verification code. Please request a new one.');
    error.statusCode = 400;
    throw error;
  }

  return true;
}

/**
 * Reset password using 6-digit OTP or legacy token
 */
export async function resetPassword(
  identifier: { email?: string; otp?: string; token?: string },
  newPassword: string
): Promise<void> {
  let user: any = null;

  if (identifier.otp && identifier.email) {
    const hashedOtp = hashToken(identifier.otp.trim());
    user = await prisma.user.findFirst({
      where: {
        email: identifier.email.toLowerCase().trim(),
        passwordResetTokenHash: hashedOtp,
        passwordResetExpiresAt: {
          gt: new Date(),
        },
      },
    });
  } else if (identifier.token) {
    const hashedToken = hashToken(identifier.token.trim());
    user = await prisma.user.findFirst({
      where: {
        passwordResetTokenHash: hashedToken,
        passwordResetExpiresAt: {
          gt: new Date(),
        },
      },
    });
  }

  if (!user) {
    const error: AppError = new Error('Invalid or expired verification code. Please request a new code.');
    error.statusCode = 400;
    throw error;
  }

  const newPasswordHash = await hashPassword(newPassword);

  // Invalidate reset token upon successful password update
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newPasswordHash,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    },
  });
}

export interface GoogleProfile {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

/**
 * Unified Google OAuth handler:
 * - If email exists, attach googleId and log into existing account.
 * - If new, create account and dispatch Welcome email.
 * - Always auto-link pending invitations.
 */
export async function handleGoogleAuth(profile: GoogleProfile): Promise<{ user: PublicUser; token: string; isNewUser?: boolean }> {
  const normalizedEmail = profile.email.toLowerCase().trim();

  // 1. Check by googleId first
  let user = await prisma.user.findUnique({
    where: { googleId: profile.id },
  });

  let isBrandNewUser = false;

  if (!user) {
    // 2. Check if a user with this email already exists
    user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      // 3. Seamlessly link Google ID to existing account (Unified Single Identity)
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: profile.id,
          fullName: user.fullName || profile.name || null,
          avatarUrl: user.avatarUrl || profile.picture || null,
          isEmailVerified: true,
        },
      });
    } else {
      // 4. Create new user for first-time Google signin
      isBrandNewUser = true;
      const baseUsername = (normalizedEmail.split('@')[0] || 'user').toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '');
      let candidateUsername = baseUsername;
      let counter = 1;
      while (await prisma.user.findFirst({ where: { username: { equals: candidateUsername, mode: 'insensitive' } } })) {
        candidateUsername = `${baseUsername}${counter++}`;
      }

      user = await prisma.user.create({
        data: {
          fullName: profile.name || null,
          username: candidateUsername,
          email: normalizedEmail,
          googleId: profile.id,
          avatarUrl: profile.picture || null,
          isEmailVerified: true,
          termsAccepted: true,
        },
      });
    }
  }

  // 5. Link any pending invitations
  await invitationService.linkPendingInvitationsForUser(user.email, user.id);

  // 6. Send welcome email if brand new user
  if (isBrandNewUser) {
    sendWelcomeEmail({
      toEmail: user.email,
      username: user.username,
      fullName: user.fullName,
    }).catch((err) => console.error('[AuthService] Welcome email dispatch failed for Google user:', err));
  }

  const tokenPayload: JwtPayload = {
    userId: user.id,
    email: user.email,
    username: user.username,
  };

  const token = generateJwt(tokenPayload);

  return {
    user: sanitizeUser(user),
    token,
    isNewUser: isBrandNewUser,
  };
}

/**
 * Update username for an authenticated user (e.g. initial Google login setup)
 */
export async function updateUsername(userId: string, newUsername: string): Promise<{ user: PublicUser; token: string }> {
  const normalizedUsername = newUsername.trim().toLowerCase();

  // Check if username is already taken by another user (case-insensitive)
  const existing = await prisma.user.findFirst({
    where: {
      username: { equals: normalizedUsername, mode: 'insensitive' },
      id: { not: userId },
    },
  });

  if (existing) {
    const error: AppError = new Error('This username is already taken');
    error.statusCode = 409;
    throw error;
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { username: normalizedUsername },
  });

  const tokenPayload: JwtPayload = {
    userId: updatedUser.id,
    email: updatedUser.email,
    username: updatedUser.username,
  };

  const token = generateJwt(tokenPayload);

  return {
    user: sanitizeUser(updatedUser),
    token,
  };
}

export const authService = {
  register,
  login,
  getUserById,
  requestPasswordReset,
  verifyPasswordResetOtp,
  resetPassword,
  handleGoogleAuth,
  updateUsername,
};
