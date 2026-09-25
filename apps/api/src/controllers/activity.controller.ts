import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { activityService } from '../services/activity.service.js';
import { AppError } from '../middlewares/error.middleware.js';

export class ActivityController {
  async getProjectActivities(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const projectId = String(req.params.projectId);
      const { category, limit, offset } = req.query;

      const result = await activityService.getProjectActivities(projectId, req.user.userId, {
        category: (category as any) || 'all',
        limit: limit ? parseInt(String(limit), 10) : 50,
        offset: offset ? parseInt(String(offset), 10) : 0,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getGlobalActivities(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const { category, limit, offset } = req.query;

      const result = await activityService.getGlobalActivities(req.user.userId, {
        category: (category as any) || 'all',
        limit: limit ? parseInt(String(limit), 10) : 50,
        offset: offset ? parseInt(String(offset), 10) : 0,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const activityController = new ActivityController();
