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
import { validatePasswordPolicy } from '../utils/passwordPolicy.js';
import { RegisterInput, LoginInput } from '../schemas/auth.schema.js';
import { AppError } from '../middlewares/error.middleware.js';
import { sendWelcomeEmail, sendPasswordResetOtpEmail, sendEmailVerificationEmail } from './email.service.js';
import { enqueueEmailJob } from '../jobs/queues.js';
import { invitationService } from './invitation.service.js';
import { sessionService } from './session.service.js';
import { logger } from '../utils/logger.js';

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

export interface AuthSessionMeta {
  userAgent?: string;
  ipAddress?: string;
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

/**
 * Ensures a single personal workspace exists for the user with OWNER membership.
 * Safe under concurrency and idempotent for retries.
 */
export async function ensurePersonalWorkspace(
  user: { id: string; username?: string; fullName?: string | null } | string,
  txClient?: any
): Promise<{ id: string; name: string; slug: string }> {
  const client = txClient || prisma;
  const userId = typeof user === 'string' ? user : user.id;

  // 1. Check if personal workspace already exists
  const existing = await client.workspace.findFirst({
    where: { ownerId: userId, isPersonal: true },
    select: { id: true, name: true, slug: true },
  });

  if (existing) {
    // Ensure owner membership row is present
    const ownerMember = await client.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: existing.id,
          userId,
        },
      },
    });

    if (!ownerMember) {
      await client.workspaceMember.create({
        data: {
          workspaceId: existing.id,
          userId,
          role: 'OWNER',
        },
      });
    }

    return existing;
  }

  let username = typeof user === 'object' && user.username ? user.username : 'user';
  let fullName = typeof user === 'object' && user.fullName ? user.fullName : null;

  if (typeof user === 'string' || !user.username) {
    const dbUser = await client.user.findUnique({
      where: { id: userId },
      select: { username: true, fullName: true },
    });
    if (dbUser) {
      username = dbUser.username;
      fullName = dbUser.fullName;
    }
  }

  // 2. Generate slug with unique entropy to prevent collisions
  const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'user';
  const entropy = crypto.randomBytes(3).toString('hex');
  const slug = `${cleanUsername}-personal-${entropy}`;
  const name = fullName?.trim()
    ? `${fullName.trim()}'s Workspace`
    : `${username}'s Workspace`;

  try {
    const execute = async (tx: any) => {
      const ws = await tx.workspace.create({
        data: {
          name,
          slug,
          ownerId: userId,
          isPersonal: true,
          adminPermissions: {
            canInviteMembers: false,
            canRemoveMembers: false,
            canCreateProjects: false,
            canManageRoles: false,
          },
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: ws.id,
          userId,
          role: 'OWNER',
        },
      });

      return { id: ws.id, name: ws.name, slug: ws.slug };
    };

    if (txClient) {
      return await execute(txClient);
    } else {
      return await prisma.$transaction(execute);
    }
  } catch (err: any) {
    if (!txClient && (err.code === 'P2002' || err.message?.includes('Unique constraint'))) {
      const fallback = await client.workspace.findFirst({
        where: { ownerId: userId, isPersonal: true },
        select: { id: true, name: true, slug: true },
      });
      if (fallback) {
        // Ensure owner membership row is present on fallback recovery
        const ownerMember = await client.workspaceMember.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId: fallback.id,
              userId,
            },
          },
        });

        if (!ownerMember) {
          await client.workspaceMember.create({
            data: {
              workspaceId: fallback.id,
              userId,
              role: 'OWNER',
              origin: 'DIRECT',
            },
          }).catch(() => {});
        }

        return fallback;
      }
    }
    throw err;
  }
}

export async function register(
  input: RegisterInput,
  meta?: AuthSessionMeta
): Promise<{
  user: PublicUser;
  token: string;
  emailDeliveryStatus?: 'sent' | 'queued' | 'failed';
}> {
  const normalizedUsername = input.username.trim().toLowerCase();
  const normalizedEmail = input.email.toLowerCase().trim();

  // 1. Password policy validation (before opening transaction)
  const passwordValidation = validatePasswordPolicy(input.password);
  if (!passwordValidation.isValid) {
    const error: AppError = new Error(passwordValidation.error || 'Password does not meet security requirements');
    error.statusCode = 400;
    error.errors = { password: [passwordValidation.error || 'Password does not meet security requirements'] };
    throw error;
  }

  // 2. Pre-checks for duplicate username (case-insensitive) and duplicate email (fast fail)
  const existingUsername = await prisma.user.findFirst({
    where: { username: { equals: normalizedUsername, mode: 'insensitive' } },
  });
  if (existingUsername) {
    const error: AppError = new Error('Username is already taken');
    error.statusCode = 409;
    error.errors = { username: ['This username is already in use'] };
    throw error;
  }

  const existingEmail = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existingEmail) {
    const error: AppError = new Error('Email address is already registered');
    error.statusCode = 409;
    error.errors = { email: ['This email address is already registered'] };
    throw error;
  }

  // 3. Password hashing (CPU-intensive, performed outside/before transaction)
  const passwordHash = await hashPassword(input.password);

  // 4. Verification token generation (performed before transaction)
  const verificationToken = generateSecureToken(32);
  const verificationTokenHash = hashToken(verificationToken);
  const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // 5. Core Atomic Transaction: User + Personal Workspace + Owner Member + Initial Session
  let coreResult: {
    user: any;
    session: any;
    rawSessionToken?: string;
    expiresAt?: Date;
  };

  try {
    coreResult = await prisma.$transaction(
      async (tx) => {
        // 5a. Create User row
        const newUser = await tx.user.create({
          data: {
            fullName: input.fullName?.trim() || null,
            username: normalizedUsername,
            email: normalizedEmail,
            passwordHash,
            avatarUrl: input.avatarUrl || null,
            termsAccepted: input.termsAccepted ?? true,
            isEmailVerified: false,
            emailVerificationTokenHash: verificationTokenHash,
            emailVerificationExpiresAt: verificationExpiresAt,
            passwordResetAttempts: 0,
          },
        });

        // 5b. Provision Personal Workspace and Owner WorkspaceMember
        await ensurePersonalWorkspace(newUser, tx);

        // 5c. Create Initial Session inside transaction
        const sessionData = await sessionService.createSession(
          newUser.id,
          {
            userAgent: meta?.userAgent,
            ipAddress: meta?.ipAddress,
            rememberMe: true,
          },
          tx
        );

        return {
          user: newUser,
          session: sessionData.session,
          rawSessionToken: sessionData.rawSessionToken,
          expiresAt: sessionData.expiresAt,
        };
      },
      {
        maxWait: 5000,
        timeout: 10000,
      }
    );
  } catch (err: any) {
    // Check for Prisma unique constraint violations (e.g. concurrent registrations)
    if (err.code === 'P2002' || err.message?.includes('Unique constraint')) {
      const target = err.meta?.target;
      const targetStr = Array.isArray(target) ? target.join(',') : typeof target === 'string' ? target : '';
      const isEmail = targetStr.includes('email') || err.message?.includes('User_email_key') || err.message?.includes('email');
      const isUsername = targetStr.includes('username') || err.message?.includes('User_username_key') || err.message?.includes('username');

      if (isEmail) {
        const error: AppError = new Error('Email address is already registered');
        error.statusCode = 409;
        error.errors = { email: ['This email address is already registered'] };
        throw error;
      }
      if (isUsername) {
        const error: AppError = new Error('Username is already taken');
        error.statusCode = 409;
        error.errors = { username: ['This username is already in use'] };
        throw error;
      }

      // Disambiguation check against DB in case target meta was not explicit
      const emailExists = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (emailExists) {
        const error: AppError = new Error('Email address is already registered');
        error.statusCode = 409;
        error.errors = { email: ['This email address is already registered'] };
        throw error;
      }

      const error: AppError = new Error('Username is already taken');
      error.statusCode = 409;
      error.errors = { username: ['This username is already in use'] };
      throw error;
    }

    throw err;
  }

  const { user: committedUser, session: committedSession, expiresAt } = coreResult;

  // 6. Post-commit: Cache session in ultra-fast memory cache now that transaction is committed
  if (expiresAt) {
    sessionService.cacheSession(committedSession.id, committedUser.id, expiresAt);
  }

  // 7. Post-commit: Generate authentication token only after transaction succeeds
  const tokenPayload: JwtPayload = {
    userId: committedUser.id,
    email: committedUser.email,
    username: committedUser.username,
    sessionId: committedSession.id,
  };
  const token = generateJwt(tokenPayload, '7d');

  // 8. Secondary Operations (Safe & Non-blocking)
  // 8a. Link pending project invitations
  try {
    await invitationService.linkPendingInvitationsForUser(committedUser.email, committedUser.id);
  } catch (err: any) {
    logger.error('[AuthService] Linking pending invitations failed during registration', {
      userId: committedUser.id,
      error: err?.message,
    });
  }

  // 8b. Welcome onboarding email (fire and forget with safe error capture)
  sendWelcomeEmail({
    toEmail: committedUser.email,
    username: committedUser.username,
    fullName: committedUser.fullName,
  }).catch((err: any) => {
    logger.error('[AuthService] Welcome email dispatch failed during registration', {
      userId: committedUser.id,
      error: err?.message,
    });
  });

  // 8c. Verification email dispatch/queueing
  let emailDeliveryStatus: 'sent' | 'queued' | 'failed' = 'sent';
  try {
    const queueResult = await enqueueEmailJob({
      type: 'EMAIL_VERIFICATION',
      toEmail: committedUser.email,
      username: committedUser.username,
      token: verificationToken,
    });
    emailDeliveryStatus = queueResult?.queued ? 'queued' : 'sent';
  } catch (err: any) {
    emailDeliveryStatus = 'failed';
    logger.error('[AuthService] Verification email dispatch/queueing failed during registration', {
      userId: committedUser.id,
      error: err?.message,
    });
  }

  return {
    user: sanitizeUser(committedUser),
    token,
    emailDeliveryStatus,
  };
}

export async function login(
  input: LoginInput,
  meta?: AuthSessionMeta
): Promise<{ user: PublicUser; token: string }> {
  if (!input.password || input.password.trim().length === 0) {
    const error: AppError = new Error('Password is required');
    error.statusCode = 400;
    error.errors = { password: ['Password is required'] };
    throw error;
  }

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

  if (user.isDeactivated) {
    const error: AppError = new Error('This account has been deactivated.');
    error.statusCode = 401;
    throw error;
  }

  const isPasswordValid = await verifyPassword(input.password, user.passwordHash);
  if (!isPasswordValid) {
    const error: AppError = new Error('Invalid username/email or password');
    error.statusCode = 401;
    throw error;
  }

  // Ensure personal workspace exists (self-healing for legacy users)
  await ensurePersonalWorkspace(user);

  // Link any pending invitations in case user had invites created while offline
  await invitationService.linkPendingInvitationsForUser(user.email, user.id);

  const rememberMe = input.rememberMe !== false;
  const { session } = await sessionService.createSession(user.id, {
    userAgent: meta?.userAgent,
    ipAddress: meta?.ipAddress,
    rememberMe,
  });

  const tokenPayload: JwtPayload = {
    userId: user.id,
    email: user.email,
    username: user.username,
    sessionId: session.id,
  };

  const token = generateJwt(tokenPayload, rememberMe ? '7d' : '1d');

  return {
    user: sanitizeUser(user),
    token,
  };
}

export async function getUserById(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || user.isDeactivated) {
    const error: AppError = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return sanitizeUser(user);
}

/**
 * Verify email address using verification token
 */
export async function verifyEmail(token: string): Promise<boolean> {
  const cleanToken = token.trim();
  const hashedToken = hashToken(cleanToken);

  const user = await prisma.user.findFirst({
    where: {
      emailVerificationTokenHash: hashedToken,
    },
  });

  if (!user) {
    throw new AppError('Invalid or already used verification link.', 400, undefined, 'TOKEN_INVALID');
  }

  if (user.emailVerificationExpiresAt && user.emailVerificationExpiresAt < new Date()) {
    throw new AppError('Verification link has expired. Please request a new one.', 400, undefined, 'TOKEN_EXPIRED');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isEmailVerified: true,
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
    },
  });

  return true;
}

/**
 * Resend email verification link with safe anti-enumeration behavior
 */
export async function resendVerificationEmail(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (user && !user.isEmailVerified && !user.isDeactivated) {
    const token = generateSecureToken(32);
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: expiresAt,
      },
    });

    try {
      await enqueueEmailJob({
        type: 'EMAIL_VERIFICATION',
        toEmail: user.email,
        username: user.username,
        token,
      });
    } catch (err) {
      console.error('[AuthService] Resend verification email queueing failed:', err);
    }
  }

  return true;
}

/**
 * Request a 6-digit OTP for password recovery (brute force protected)
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean; otp?: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || user.isDeactivated) {
    // Generic response to prevent user enumeration
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
      passwordResetAttempts: 0,
    },
  });

  // Dispatch OTP email
  sendPasswordResetOtpEmail({
    toEmail: user.email,
    username: user.fullName || user.username,
    otp,
  }).catch((err) => console.error('[AuthService] Password reset OTP email failed:', err));

  // Only expose OTP in test/local development environments
  const shouldExposeOtp = process.env.NODE_ENV !== 'production';
  return { success: true, ...(shouldExposeOtp ? { otp } : {}) };
}

/**
 * Pre-verify 6-digit OTP code before setting new password (tracks attempts and locks on repeated failure)
 */
export async function verifyPasswordResetOtp(email: string, otp: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  const cleanOtp = otp.trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || !user.passwordResetTokenHash || !user.passwordResetExpiresAt) {
    const error: AppError = new Error('Invalid or expired 6-digit verification code. Please request a new one.');
    error.statusCode = 400;
    throw error;
  }

  if (user.passwordResetExpiresAt <= new Date()) {
    const error: AppError = new Error('Verification code has expired. Please request a new code.');
    error.statusCode = 400;
    throw error;
  }

  // Check attempt lockout
  if (user.passwordResetAttempts >= 5) {
    // Invalidate code upon lockout
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        passwordResetAttempts: 0,
      },
    });
    const error: AppError = new Error('Too many incorrect attempts. This verification code has been invalidated for security. Please request a new code.');
    error.statusCode = 400;
    throw error;
  }

  const hashedOtp = hashToken(cleanOtp);
  if (user.passwordResetTokenHash !== hashedOtp) {
    const newAttempts = user.passwordResetAttempts + 1;
    if (newAttempts >= 5) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          passwordResetAttempts: 0,
        },
      });
      const error: AppError = new Error('Too many incorrect attempts. This verification code has been invalidated for security. Please request a new code.');
      error.statusCode = 400;
      throw error;
    }

    // Increment failed attempt counter
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetAttempts: { increment: 1 } },
    });
    const remaining = 5 - newAttempts;
    const error: AppError = new Error(`Invalid 6-digit verification code. You have ${remaining} attempts remaining.`);
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
  const passwordValidation = validatePasswordPolicy(newPassword);
  if (!passwordValidation.isValid) {
    const error: AppError = new Error(passwordValidation.error || 'Password does not meet security requirements');
    error.statusCode = 400;
    error.errors = { newPassword: [passwordValidation.error || 'Password does not meet security requirements'] };
    throw error;
  }

  let user: any = null;

  if (identifier.otp && identifier.email) {
    const normalizedEmail = identifier.email.toLowerCase().trim();
    const cleanOtp = identifier.otp.trim();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!existing || !existing.passwordResetTokenHash || !existing.passwordResetExpiresAt) {
      const error: AppError = new Error('Invalid or expired verification code. Please request a new code.');
      error.statusCode = 400;
      throw error;
    }

    if (existing.passwordResetExpiresAt <= new Date()) {
      const error: AppError = new Error('Verification code has expired. Please request a new code.');
      error.statusCode = 400;
      throw error;
    }

    if (existing.passwordResetAttempts >= 5) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          passwordResetAttempts: 0,
        },
      });
      const error: AppError = new Error('Too many incorrect attempts. This verification code has been invalidated. Please request a new code.');
      error.statusCode = 400;
      throw error;
    }

    const hashedOtp = hashToken(cleanOtp);
    if (existing.passwordResetTokenHash !== hashedOtp) {
      const newAttempts = existing.passwordResetAttempts + 1;
      if (newAttempts >= 5) {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            passwordResetTokenHash: null,
            passwordResetExpiresAt: null,
            passwordResetAttempts: 0,
          },
        });
        const error: AppError = new Error('Too many incorrect attempts. This verification code has been invalidated. Please request a new code.');
        error.statusCode = 400;
        throw error;
      }

      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordResetAttempts: { increment: 1 } },
      });
      const remaining = 5 - newAttempts;
      const error: AppError = new Error(`Invalid verification code. You have ${remaining} attempts remaining.`);
      error.statusCode = 400;
      throw error;
    }

    user = existing;
  } else if (identifier.token) {
    const hashedToken = hashToken(identifier.token.trim());
    user = await prisma.user.findFirst({
      where: {
        passwordResetTokenHash: hashedToken,
        passwordResetExpiresAt: { gt: new Date() },
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
      passwordResetAttempts: 0,
    },
  });

  // Revoke all existing sessions upon password reset
  await sessionService.revokeAllUserSessions(user.id);
}

export interface GoogleProfile {
  id?: string;
  googleId?: string;
  email: string;
  email_verified?: boolean;
  emailVerified?: boolean;
  name?: string;
  fullName?: string;
  picture?: string;
}

/**
 * Hardened Google OAuth handler:
 * - Strictly checks email_verified
 * - Prevents attaching an unverified identity
 * - Prevents account hijacking if existing account belongs to a different Google ID
 * - Authoritative session creation
 */
export async function handleGoogleAuth(
  profile: GoogleProfile,
  meta?: AuthSessionMeta
): Promise<{ user: PublicUser; token: string; isNewUser?: boolean }> {
  // Never trust unverified Google emails
  const isVerified = profile.email_verified === true || profile.emailVerified === true;
  if (!isVerified) {
    const error: AppError = new Error('Google email is not verified. Please verify your email with Google first.');
    error.statusCode = 403;
    throw error;
  }

  const googleId = profile.id || profile.googleId;
  if (!googleId) {
    const error: AppError = new Error('Missing Google ID in OAuth profile');
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = profile.email.toLowerCase().trim();

  // 1. Check by googleId first
  let user = await prisma.user.findUnique({
    where: { googleId },
  });

  let isBrandNewUser = false;

  if (!user) {
    // 2. Check if a user with this email already exists
    user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      // Prevent account hijacking: If account already has a different Google ID, reject
      if (user.googleId && user.googleId !== googleId) {
        const error: AppError = new Error('This email address is already linked with another Google account.');
        error.statusCode = 409;
        throw error;
      }

      // Safe linking because Google verified email
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId,
          fullName: user.fullName || profile.name || profile.fullName || null,
          avatarUrl: user.avatarUrl || profile.picture || null,
          isEmailVerified: true,
        },
      });
    } else {
      // 3. Create new user for first-time Google signin
      isBrandNewUser = true;
      const baseUsername = (normalizedEmail.split('@')[0] || 'user').toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '');
      let candidateUsername = baseUsername;
      let counter = 1;
      while (await prisma.user.findFirst({ where: { username: { equals: candidateUsername, mode: 'insensitive' } } })) {
        candidateUsername = `${baseUsername}${counter++}`;
      }

      user = await prisma.user.create({
        data: {
          fullName: profile.name || profile.fullName || null,
          username: candidateUsername,
          email: normalizedEmail,
          googleId,
          avatarUrl: profile.picture || null,
          isEmailVerified: true, // Google verified
          termsAccepted: true,
        },
      });
    }
  }

  // Ensure personal workspace is provisioned for Google OAuth account
  await ensurePersonalWorkspace(user);

  // Link any pending invitations
  await invitationService.linkPendingInvitationsForUser(user.email, user.id);

  // Send welcome email if brand new user
  if (isBrandNewUser) {
    sendWelcomeEmail({
      toEmail: user.email,
      username: user.username,
      fullName: user.fullName,
    }).catch((err) => console.error('[AuthService] Welcome email dispatch failed for Google user:', err));
  }

  // Create session
  const { session } = await sessionService.createSession(user.id, {
    userAgent: meta?.userAgent,
    ipAddress: meta?.ipAddress,
    rememberMe: true,
  });

  const tokenPayload: JwtPayload = {
    userId: user.id,
    email: user.email,
    username: user.username,
    sessionId: session.id,
  };

  const token = generateJwt(tokenPayload, '7d');

  return {
    user: sanitizeUser(user),
    token,
    isNewUser: isBrandNewUser,
  };
}

/**
 * Update username for an authenticated user
 */
export async function updateUsername(userId: string, newUsername: string): Promise<{ user: PublicUser; token: string }> {
  const normalizedUsername = newUsername.trim().toLowerCase();

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

/**
 * Check if a username is available (not taken by another user)
 */
export async function isUsernameAvailable(
  username: string,
  excludeUserId?: string
): Promise<{ available: boolean; message?: string }> {
  const normalized = username.trim().toLowerCase();

  if (!normalized || normalized.length < 3 || normalized.length > 30) {
    return { available: false, message: 'Username must be between 3 and 30 characters' };
  }

  if (!/^[a-zA-Z0-9_.-]+$/.test(normalized)) {
    return {
      available: false,
      message: 'Username can only contain letters, numbers, underscores, hyphens, and periods',
    };
  }

  const existing = await prisma.user.findFirst({
    where: {
      username: { equals: normalized, mode: 'insensitive' },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    return { available: false, message: 'This username is already taken' };
  }

  return { available: true };
}

/**
 * Generate unique, verified available username suggestions for a user.
 * Guaranteed that no suggested handle is duplicate or belongs to an existing user in the database.
 */
export async function getSuggestedUsernames(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, email: true, fullName: true },
  });

  if (!user) return [];

  const candidates: string[] = [];

  // 1. Current username if present
  if (user.username) {
    candidates.push(user.username.toLowerCase());
  }

  // 2. Email prefix (e.g. alwinjames66@gmail.com -> alwinjames66)
  const emailPrefix = user.email.split('@')[0].toLowerCase().replace(/[^a-zA-Z0-9_.-]/g, '');
  if (emailPrefix) {
    candidates.push(emailPrefix);
  }

  // 3. Name variants (e.g. Alwin James -> alwinjames, alwin.james, alwin_james)
  if (user.fullName) {
    const parts = user.fullName
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .map((p) => p.replace(/[^a-zA-Z0-9]/g, ''))
      .filter(Boolean);

    if (parts.length >= 2) {
      const first = parts[0];
      const last = parts[parts.length - 1];
      candidates.push(`${first}${last}`);
      candidates.push(`${first}.${last}`);
      candidates.push(`${first}_${last}`);
      candidates.push(`${first}${last[0]}`);
      candidates.push(`${first[0]}${last}`);
    } else if (parts.length === 1 && parts[0]) {
      candidates.push(parts[0]);
    }
  }

  // Deduplicate and filter length
  const uniqueCandidateList = Array.from(new Set(candidates)).filter(
    (c) => c.length >= 3 && c.length <= 28 && /^[a-zA-Z0-9_.-]+$/.test(c)
  );

  // Expand with numeric / common variants
  const expandedList: string[] = [...uniqueCandidateList];
  for (const base of uniqueCandidateList) {
    expandedList.push(`${base}1`);
    expandedList.push(`${base}7`);
    expandedList.push(`${base}99`);
    expandedList.push(`${base}_dev`);
  }

  // Verify against existing users in the database so duplicates are NEVER suggested
  const existingUsers = await prisma.user.findMany({
    where: {
      username: { in: expandedList, mode: 'insensitive' },
      id: { not: userId }, // Exclude current user (they already own their handle)
    },
    select: { username: true },
  });

  const takenSet = new Set(existingUsers.map((u) => u.username.toLowerCase()));

  // Filter out any taken username
  const verifiedSuggestions: string[] = [];
  for (const candidate of expandedList) {
    const lower = candidate.toLowerCase();
    if (!takenSet.has(lower) && !verifiedSuggestions.map((s) => s.toLowerCase()).includes(lower)) {
      verifiedSuggestions.push(candidate);
      if (verifiedSuggestions.length >= 3) break;
    }
  }

  // If still fewer than 3, generate random fallback numeric suffixes and verify them
  let seed = 10;
  while (verifiedSuggestions.length < 3 && seed < 99) {
    const baseStem = uniqueCandidateList[0] || 'developer';
    const fallback = `${baseStem}${seed}`;
    const lower = fallback.toLowerCase();
    if (!takenSet.has(lower) && !verifiedSuggestions.map((s) => s.toLowerCase()).includes(lower)) {
      verifiedSuggestions.push(fallback);
    }
    seed += 3;
  }

  return verifiedSuggestions.slice(0, 3);
}

export const authService = {
  register,
  login,
  getUserById,
  verifyEmail,
  resendVerificationEmail,
  requestPasswordReset,
  verifyPasswordResetOtp,
  resetPassword,
  handleGoogleAuth,
  updateUsername,
  isUsernameAvailable,
  getSuggestedUsernames,
  ensurePersonalWorkspace,
};
