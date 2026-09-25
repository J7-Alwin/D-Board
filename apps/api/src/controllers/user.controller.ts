import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/user.service.js';
import {
  updateProfileSchema,
  changePasswordSchema,
  updateNotificationPreferencesSchema,
  deleteAccountSchema,
} from '../schemas/user.schema.js';

export async function getProfileHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const profile = await userService.getUserProfile(userId);

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateProfileHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const validatedData = updateProfileSchema.parse(req.body);
    const updatedProfile = await userService.updateUserProfile(userId, validatedData);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedProfile,
    });
  } catch (err) {
    next(err);
  }
}

export async function changePasswordHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const validatedData = changePasswordSchema.parse(req.body);
    const result = await userService.changeUserPassword(userId, validatedData, {
      ip: req.ip || (req.headers['x-forwarded-for'] as string),
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateNotificationPreferencesHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const validatedData = updateNotificationPreferencesSchema.parse(req.body);
    const updatedPrefs = await userService.updateNotificationPreferences(userId, validatedData);

    res.status(200).json({
      success: true,
      message: 'Notification preferences updated',
      data: updatedPrefs,
    });
  } catch (err) {
    next(err);
  }
}

export async function exportDataHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const archive = await userService.exportUserData(userId);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="d-board-data-export-${new Date().toISOString().split('T')[0]}.json"`
    );

    res.status(200).json({
      success: true,
      data: archive,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteAccountHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    deleteAccountSchema.parse(req.body);

    await userService.deleteUserAccount(userId);

    // Clear authentication cookies
    res.clearCookie('token');

    res.status(200).json({
      success: true,
      message: 'Your account has been deactivated and your personal details have been anonymized.',
    });
  } catch (err) {
    next(err);
  }
}
