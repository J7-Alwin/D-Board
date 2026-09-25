import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { projectService } from '../services/project.service.js';
import { AppError } from '../middlewares/error.middleware.js';

export class ProjectController {
  async createProject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const project = await projectService.createProject(req.user.userId, req.body);
      res.status(201).json({
        success: true,
        message: 'Project created successfully',
        data: { project },
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserProjects(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const projects = await projectService.getUserProjects(req.user.userId);
      res.status(200).json({
        success: true,
        data: projects,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProjectById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const projectId = String(req.params.projectId);
      const project = await projectService.getProjectById(projectId, req.user.userId);
      res.status(200).json({
        success: true,
        data: { project },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const projectId = String(req.params.projectId);
      const project = await projectService.updateProject(projectId, req.user.userId, req.body);
      res.status(200).json({
        success: true,
        message: 'Project updated successfully',
        data: { project },
      });
    } catch (error) {
      next(error);
    }
  }

  async archiveProject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const projectId = String(req.params.projectId);
      const project = await projectService.archiveProject(projectId, req.user.userId);
      res.status(200).json({
        success: true,
        message: 'Project archived successfully',
        data: { project },
      });
    } catch (error) {
      next(error);
    }
  }

  async unarchiveProject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const projectId = String(req.params.projectId);
      const project = await projectService.unarchiveProject(projectId, req.user.userId);
      res.status(200).json({
        success: true,
        message: 'Project restored from archive successfully',
        data: { project },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteProject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const projectId = String(req.params.projectId);
      const confirmProjectName = (req.body?.confirmProjectName || req.query?.confirmProjectName) as string | undefined;
      const result = await projectService.deleteProject(projectId, req.user.userId, confirmProjectName);
      res.status(200).json({
        success: true,
        message: 'Project deleted successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async transferOwnership(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const projectId = String(req.params.projectId);
      const { targetUserId } = req.body;
      if (!targetUserId) {
        throw new AppError('Target user ID is required', 400);
      }
      const result = await projectService.transferOwnership(projectId, req.user.userId, targetUserId);
      res.status(200).json({
        success: true,
        message: 'Project ownership transferred successfully',
        data: { project: result },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const projectController = new ProjectController();
