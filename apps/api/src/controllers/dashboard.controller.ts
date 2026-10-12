import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { WorkspaceRequest } from '../middlewares/workspace.middleware.js';
import { dashboardService } from '../services/dashboard.service.js';
import { AppError } from '../middlewares/error.middleware.js';

export class DashboardController {
  async getDashboard(req: WorkspaceRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const data = await dashboardService.getDashboardSummary(req.user.userId, req.workspaceId);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardController = new DashboardController();
