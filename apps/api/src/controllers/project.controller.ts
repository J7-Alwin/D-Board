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

  async deleteProject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const projectId = String(req.params.projectId);
      const result = await projectService.deleteProject(projectId, req.user.userId);
      res.status(200).json({
        success: true,
        message: 'Project deleted successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const projectController = new ProjectController();
