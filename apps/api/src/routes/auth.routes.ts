import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { passwordResetRateLimiter } from '../middlewares/rateLimit.middleware.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  updateUsernameSchema,
} from '../schemas/auth.schema.js';

const router = Router();

// Public auth endpoints
router.post('/register', validateBody(registerSchema), authController.register);
router.post('/login', validateBody(loginSchema), authController.login);
router.post('/forgot-password', passwordResetRateLimiter, validateBody(forgotPasswordSchema), authController.forgotPassword);
router.post('/verify-otp', passwordResetRateLimiter, validateBody(verifyOtpSchema), authController.verifyOtp);
router.post('/reset-password', passwordResetRateLimiter, validateBody(resetPasswordSchema), authController.resetPassword);
router.post('/verify-email', validateBody(verifyEmailSchema), authController.verifyEmail);
router.post('/resend-verification', passwordResetRateLimiter, validateBody(resendVerificationSchema), authController.resendVerification);

// Google OAuth endpoints
router.get('/google', authController.googleAuth);
router.get('/google/callback', authController.googleCallback);

// Authenticated session endpoints
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.getMe);
router.patch('/username', authenticate, validateBody(updateUsernameSchema), authController.updateUsername);

export default router;
