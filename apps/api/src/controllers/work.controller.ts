import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { workService } from '../services/work.service.js';
import { AppError } from '../middlewares/error.middleware.js';

export class WorkController {
  async createWorkItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const projectId = String(req.params.projectId);
      const workItem = await workService.createWorkItem(projectId, req.user.userId, req.body);
      res.status(201).json({
        success: true,
        message: 'Work item created successfully',
        data: { workItem },
      });
    } catch (error) {
      next(error);
    }
  }

  async getProjectWorkItems(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const projectId = String(req.params.projectId);
      const { status, priority, type, assignedToId, search } = req.query;

      const result = await workService.getProjectWorkItems(projectId, req.user.userId, {
        status: status ? String(status) : undefined,
        priority: priority ? String(priority) : undefined,
        type: type ? String(type) : undefined,
        assignedToId: assignedToId ? String(assignedToId) : undefined,
        search: search ? String(search) : undefined,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getWorkItemById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const projectId = String(req.params.projectId);
      const workItemId = String(req.params.workItemId);
      const workItem = await workService.getWorkItemById(projectId, workItemId, req.user.userId);

      res.status(200).json({
        success: true,
        data: { workItem },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateWorkItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const projectId = String(req.params.projectId);
      const workItemId = String(req.params.workItemId);
      const workItem = await workService.updateWorkItem(projectId, workItemId, req.user.userId, req.body);

      res.status(200).json({
        success: true,
        message: 'Work item updated successfully',
        data: { workItem },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteWorkItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const projectId = String(req.params.projectId);
      const workItemId = String(req.params.workItemId);
      await workService.deleteWorkItem(projectId, workItemId, req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Work item deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getMyWorkItems(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const { tab, status, priority, type, projectId, search, sort, page, limit } = req.query;

      const result = await workService.getMyWorkItems(req.user.userId, {
        tab: tab as any,
        status: status ? String(status) : undefined,
        priority: priority ? String(priority) : undefined,
        type: type ? String(type) : undefined,
        projectId: projectId ? String(projectId) : undefined,
        search: search ? String(search) : undefined,
        sort: sort as any,
        page: page ? parseInt(String(page), 10) : 1,
        limit: limit ? parseInt(String(limit), 10) : 10,
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

export const workController = new WorkController();

