import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';

const COOKIE_NAME = 'token';
const IS_PROD = process.env.NODE_ENV === 'production';

function setAuthCookie(res: Response, token: string, rememberMe = true): void {
  const maxAge = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 7 days or 1 day
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    maxAge,
    path: '/',
  });
}

function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/',
  });
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user, token } = await authService.register(req.body);
    setAuthCookie(res, token, true);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: { user, token },
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user, token } = await authService.login(req.body);
    setAuthCookie(res, token, req.body.rememberMe !== false);

    res.status(200).json({
      success: true,
      message: 'Signed in successfully',
      data: { user, token },
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

export async function logout(_req: Request, res: Response): Promise<void> {
  clearAuthCookie(res);
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.requestPasswordReset(req.body.email);

    // Always respond with a generic success message to prevent user enumeration
    res.status(200).json({
      success: true,
      message: "If an account exists with this email, a 6-digit verification code has been sent.",
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
      message: 'Password reset successfully. Please sign in with your new password.',
    });
  } catch (error) {
    next(error);
  }
}

export async function googleAuth(_req: Request, res: Response): Promise<void> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';

  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    res.status(503).json({
      success: false,
      message: 'Google authentication is not configured in this environment. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
    });
    return;
  }

  const scope = encodeURIComponent('openid email profile');
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    callbackUrl
  )}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

  res.redirect(googleAuthUrl);
}

export async function googleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code } = req.query;
    const clientUrl = process.env.APP_URL || 'http://localhost:5173';

    if (!code || typeof code !== 'string') {
      res.redirect(`${clientUrl}/login?error=oauth_code_missing`);
      return;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';

    if (!clientId || !clientSecret) {
      res.redirect(`${clientUrl}/login?error=oauth_not_configured`);
      return;
    }

    // Exchange code for token
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

    // Fetch user info with access token
    const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userinfoResponse.ok) {
      res.redirect(`${clientUrl}/login?error=oauth_userinfo_failed`);
      return;
    }

    const googleUser = await userinfoResponse.json();

    const { token, isNewUser } = await authService.handleGoogleAuth({
      id: googleUser.sub,
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture,
    });

    setAuthCookie(res, token, true);
    const redirectTarget = isNewUser
      ? `${clientUrl}/app/dashboard?first_login=true&google_signup=true`
      : `${clientUrl}/app/dashboard`;
    res.redirect(redirectTarget);
  } catch (error) {
    next(error);
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
      data: { user, token },
    });
  } catch (error) {
    next(error);
  }
}

