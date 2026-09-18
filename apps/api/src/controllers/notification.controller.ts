import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { notificationService } from '../services/notification.service.js';
import { AppError } from '../middlewares/error.middleware.js';

export class NotificationController {
  /**
   * GET /api/notifications
   * List paginated notifications for the authenticated user
   */
  async getNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const userId = req.user.userId;
      const { category, unreadOnly, page, limit } = req.query;

      const result = await notificationService.getUserNotifications(userId, {
        category: category as any,
        unreadOnly: unreadOnly === 'true',
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/notifications/unread-count
   * Get unread notification count
   */
  async getUnreadCount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const userId = req.user.userId;
      const count = await notificationService.getUnreadCount(userId);

      res.status(200).json({
        success: true,
        data: { count },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/notifications/:id/read
   * Mark a single notification as read
   */
  async markAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const userId = req.user.userId;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const updated = await notificationService.markAsRead(id, userId);

      res.status(200).json({
        success: true,
        data: { notification: updated },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/notifications/read-all
   * Mark all unread notifications as read
   */
  async markAllAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const userId = req.user.userId;
      const { category } = req.body || {};

      const result = await notificationService.markAllAsRead(userId, category);

      res.status(200).json({
        success: true,
        message: 'All notifications marked as read',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/notifications/:id
   * Delete a notification
   */
  async deleteNotification(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const userId = req.user.userId;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const result = await notificationService.deleteNotification(id, userId);

      res.status(200).json({
        success: true,
        message: 'Notification deleted successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const notificationController = new NotificationController();
