import type { Response, NextFunction } from 'express';
import multer from 'multer';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { fileService } from '../services/file.service.js';
import { fileQuerySchema, renameFileSchema, attachFileSchema } from '../schemas/file.schema.js';
import { AppError } from '../middlewares/error.middleware.js';

// Max file size in MB (defaults to 50MB)
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB) || 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Configure multer memory storage
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 10, // Up to 10 files per batch
  },
});

export class FileController {
  /**
   * Upload one or more files to project.
   */
  async uploadFiles(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string;
      const userId = req.user.userId;
      const workItemId = (req.body?.workItemId as string) || null;
      const noteId = (req.body?.noteId as string) || null;

      const rawFiles = req.files as Express.Multer.File[] | undefined;
      const singleFile = req.file as Express.Multer.File | undefined;

      const filesToProcess = rawFiles || (singleFile ? [singleFile] : []);

      if (filesToProcess.length === 0) {
        throw new AppError('No files were uploaded', 400);
      }

      const payloads = filesToProcess.map((f) => ({
        originalname: Buffer.from(f.originalname, 'latin1').toString('utf8'), // handle utf8 filenames
        mimetype: f.mimetype,
        size: f.size,
        buffer: f.buffer,
      }));

      const created = await fileService.uploadFiles(projectId, userId, payloads, { workItemId, noteId });

      res.status(201).json({
        success: true,
        message: `${created.length} file(s) uploaded successfully`,
        data: { files: created },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List files for project.
   */
  async getProjectFiles(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string;
      const userId = req.user.userId;
      const query = fileQuerySchema.parse(req.query);

      const result = await fileService.getProjectFiles(projectId, userId, query);

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Global files aggregator across accessible projects.
   */
  async getGlobalFiles(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const userId = req.user.userId;
      const query = fileQuerySchema.parse(req.query);

      const result = await fileService.getGlobalFiles(userId, query);

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get single file metadata.
   */
  async getFileById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string;
      const fileId = req.params.fileId as string;
      const userId = req.user.userId;

      const file = await fileService.getFileById(projectId, fileId, userId);

      res.json({
        success: true,
        data: { file },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Stream file content for in-platform viewer.
   */
  async getFileContent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string;
      const fileId = req.params.fileId as string;
      const userId = req.user.userId;

      const { file, stream } = await fileService.getFileStream(projectId, fileId, userId);

      res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
      res.setHeader('Content-Length', file.sizeBytes);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(file.originalName)}"`
      );

      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Download file with forced attachment disposition.
   */
  async downloadFile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string;
      const fileId = req.params.fileId as string;
      const userId = req.user.userId;

      const { file, stream } = await fileService.getFileStream(projectId, fileId, userId);

      res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
      res.setHeader('Content-Length', file.sizeBytes);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(file.originalName)}"`
      );

      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Rename file.
   */
  async renameFile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string;
      const fileId = req.params.fileId as string;
      const userId = req.user.userId;
      const body = renameFileSchema.parse(req.body);

      const file = await fileService.renameFile(projectId, fileId, userId, body.name);

      res.json({
        success: true,
        message: 'File renamed successfully',
        data: { file },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Delete file.
   */
  async deleteFile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string;
      const fileId = req.params.fileId as string;
      const userId = req.user.userId;

      const result = await fileService.deleteFile(projectId, fileId, userId);

      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Attach/detach file to work item.
   */
  async attachToWorkItem(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string;
      const fileId = req.params.fileId as string;
      const userId = req.user.userId;
      const body = attachFileSchema.parse(req.body);

      const file = await fileService.attachToWorkItem(projectId, fileId, userId, body.workItemId || null);

      res.json({
        success: true,
        message: 'File attachment updated',
        data: { file },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get user storage stats & 200 MB limit breakdown.
   */
  async getStorageStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const userId = req.user.userId;

      const stats = await fileService.getUserStorageStats(userId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const fileController = new FileController();
