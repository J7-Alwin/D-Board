import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { sessionService } from '../services/session.service.js';
import { generateSecureToken, verifyJwt } from '../utils/security.js';
import env from '../config/env.js';

const COOKIE_NAME = 'token';
const OAUTH_STATE_COOKIE = 'oauth_state';
const IS_PROD = process.env.NODE_ENV === 'production';
const SAME_SITE = ((process.env.COOKIE_SAME_SITE || env.COOKIE_SAME_SITE || 'lax') as 'lax' | 'none' | 'strict');
const COOKIE_SECURE = SAME_SITE === 'none' ? true : IS_PROD;

function setAuthCookie(res: Response, token: string, rememberMe = true): void {
  const maxAge = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 7 days or 1 day
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: SAME_SITE,
    maxAge,
    path: '/',
  });
}

function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: SAME_SITE,
    path: '/',
  });
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const meta = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.socket.remoteAddress,
    };
    const { user, token, verificationToken } = await authService.register(req.body, meta);
    setAuthCookie(res, token, true);

    res.status(201).json({
      success: true,
      message: 'Account created successfully. A verification link has been sent to your email.',
      data: {
        user,
        ...(process.env.NODE_ENV !== 'production' ? { verificationToken } : {}),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const meta = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.socket.remoteAddress,
    };
    const { user, token } = await authService.login(req.body, meta);
    setAuthCookie(res, token, req.body.rememberMe !== false);

    res.status(200).json({
      success: true,
      message: 'Signed in successfully',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const user = await authService.getUserById(req.user.userId);
    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    // 1. Invalidate session if user authenticated on request
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.sessionId) {
      await sessionService.revokeSession(authReq.user.sessionId);
    } else {
      // Check cookie or header for session token to revoke
      const token = req.cookies?.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);
      if (token) {
        try {
          const payload = verifyJwt(token);
          if (payload.sessionId) {
            await sessionService.revokeSession(payload.sessionId);
          }
        } catch {
          // ignore parsing error on logout
        }
      }
    }
  } catch (err) {
    console.warn('[Logout]: Failed to revoke session on logout:', err);
  }

  clearAuthCookie(res);
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
}

export async function verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token } = req.body;
    await authService.verifyEmail(token);

    res.status(200).json({
      success: true,
      message: 'Email address verified successfully. You can now accept project invitations.',
    });
  } catch (error) {
    next(error);
  }
}

export async function resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = req.body;
    await authService.resendVerificationEmail(email);

    res.status(200).json({
      success: true,
      message: 'If an account exists with this email address, a new verification link has been dispatched.',
    });
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.requestPasswordReset(req.body.email);

    // Always respond with a generic success message to prevent user enumeration
    res.status(200).json({
      success: true,
      message: 'If an account exists with this email, a 6-digit verification code has been sent.',
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, otp } = req.body;
    await authService.verifyPasswordResetOtp(email, otp);

    res.status(200).json({
      success: true,
      message: 'Verification code verified successfully.',
    });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, otp, token, newPassword } = req.body;
    await authService.resetPassword({ email, otp, token }, newPassword);

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. All previous sessions have been revoked. Please sign in with your new password.',
    });
  } catch (error) {
    next(error);
  }
}

export async function googleAuth(_req: Request, res: Response): Promise<void> {
  const clientId = env.GOOGLE_CLIENT_ID;
  const callbackUrl = env.GOOGLE_CALLBACK_URL || `${env.APP_URL}/api/auth/google/callback`;

  if (!clientId || !env.GOOGLE_CLIENT_SECRET) {
    res.status(503).json({
      success: false,
      message: 'Google authentication is not configured in this environment. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
    });
    return;
  }

  // Generate cryptographic state parameter to prevent CSRF
  const state = generateSecureToken(24);
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: SAME_SITE,
    maxAge: 10 * 60 * 1000, // 10 minutes
    path: '/',
  });

  const scope = encodeURIComponent('openid email profile');
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    callbackUrl
  )}&response_type=code&scope=${scope}&state=${encodeURIComponent(state)}&access_type=offline&prompt=consent`;

  res.redirect(googleAuthUrl);
}

export async function googleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code, state } = req.query;
    const clientUrl = env.CLIENT_URL || env.APP_URL;

    // Verify state parameter to prevent CSRF
    const expectedState = req.cookies?.[OAUTH_STATE_COOKIE];
    res.clearCookie(OAUTH_STATE_COOKIE, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: SAME_SITE,
      path: '/',
    });

    if (!state || !expectedState || state !== expectedState) {
      res.redirect(`${clientUrl}/login?error=oauth_state_mismatch`);
      return;
    }

    if (!code || typeof code !== 'string') {
      res.redirect(`${clientUrl}/login?error=oauth_code_missing`);
      return;
    }

    const clientId = env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;
    const callbackUrl = env.GOOGLE_CALLBACK_URL || `${env.APP_URL}/api/auth/google/callback`;

    if (!clientId || !clientSecret) {
      res.redirect(`${clientUrl}/login?error=oauth_not_configured`);
      return;
    }

    // Exchange authorization code for token directly with Google
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      res.redirect(`${clientUrl}/login?error=oauth_token_exchange_failed`);
      return;
    }

    const tokenData = await tokenResponse.json();

    // Fetch user profile with token
    const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userinfoResponse.ok) {
      res.redirect(`${clientUrl}/login?error=oauth_userinfo_failed`);
      return;
    }

    const googleUser = await userinfoResponse.json();

    // Enforce email_verified claim
    if (!googleUser.email_verified) {
      res.redirect(`${clientUrl}/login?error=oauth_email_unverified`);
      return;
    }

    const meta = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.socket.remoteAddress,
    };

    const { token, isNewUser } = await authService.handleGoogleAuth(
      {
        id: googleUser.sub,
        email: googleUser.email,
        email_verified: Boolean(googleUser.email_verified),
        name: googleUser.name,
        picture: googleUser.picture,
      },
      meta
    );

    setAuthCookie(res, token, true);
    const redirectTarget = isNewUser
      ? `${clientUrl}/app/dashboard?first_login=true&google_signup=true`
      : `${clientUrl}/app/dashboard`;
    res.redirect(redirectTarget);
  } catch (error: any) {
    const clientUrl = env.APP_URL;
    res.redirect(`${clientUrl}/login?error=${encodeURIComponent(error?.message || 'oauth_failed')}`);
  }
}

export async function updateUsername(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { username } = req.body;
    const { user, token } = await authService.updateUsername(req.user.userId, username);
    setAuthCookie(res, token, true);

    res.status(200).json({
      success: true,
      message: 'Username updated successfully',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}
