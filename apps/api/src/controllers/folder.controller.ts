import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { folderService } from '../services/folder.service.js';
import { AppError } from '../middlewares/error.middleware.js';

export class FolderController {
  async getProjectFolders(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string;
      const folders = await folderService.getProjectFolders(projectId, req.user.userId);
      res.status(200).json({
        success: true,
        data: { folders },
      });
    } catch (error) {
      next(error);
    }
  }

  async createFolder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string;
      const { name, parentId } = req.body;
      const folder = await folderService.createFolder(projectId, req.user.userId, name, parentId);
      res.status(201).json({
        success: true,
        message: 'Folder created successfully',
        data: { folder },
      });
    } catch (error) {
      next(error);
    }
  }

  async renameFolder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string;
      const folderId = req.params.folderId as string;
      const { name } = req.body;
      const folder = await folderService.renameFolder(projectId, folderId, req.user.userId, name);
      res.status(200).json({
        success: true,
        message: 'Folder renamed successfully',
        data: { folder },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteFolder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string;
      const folderId = req.params.folderId as string;
      const result = await folderService.deleteFolder(projectId, folderId, req.user.userId);
      res.status(200).json({
        success: true,
        message: 'Folder deleted successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async moveFile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string;
      const fileId = req.params.fileId as string;
      const { folderId } = req.body;
      const file = await folderService.moveFile(projectId, fileId, req.user.userId, folderId);
      res.status(200).json({
        success: true,
        message: 'File moved successfully',
        data: { file },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const folderController = new FolderController();
