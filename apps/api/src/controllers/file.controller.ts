import type { Response, NextFunction } from 'express';
import multer from 'multer';
import os from 'os';
import path from 'path';
import fs from 'fs';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { fileService } from '../services/file.service.js';
import { fileQuerySchema, renameFileSchema, attachFileSchema } from '../schemas/file.schema.js';
import { AppError } from '../middlewares/error.middleware.js';

// Max file size in MB (defaults to 50MB per file, 100MB per multipart batch for Render Free RAM)
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB) || 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const MAX_BATCH_SIZE_BYTES = 100 * 1024 * 1024;

// Dedicated temporary upload directory to prevent RAM exhaustion
const TEMP_UPLOAD_DIR = path.join(os.tmpdir(), 'dboard-temp-uploads');
if (!fs.existsSync(TEMP_UPLOAD_DIR)) {
  fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
}

// Configure multer disk storage for memory safety
export const uploadMiddleware = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, TEMP_UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const safeBase = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${uniqueSuffix}-${safeBase}`);
    },
  }),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 10, // Up to 10 files per batch
  },
});

export class FileController {
  /**
   * Upload one or more files to project with memory-safe temp streaming.
   */
  async uploadFiles(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const rawFiles = req.files as Express.Multer.File[] | undefined;
    const singleFile = req.file as Express.Multer.File | undefined;
    const filesToProcess = rawFiles || (singleFile ? [singleFile] : []);

    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string;
      const userId = req.user.userId;
      const workItemId = (req.body?.workItemId as string) || null;
      const noteId = (req.body?.noteId as string) || null;
      const folderId = (req.body?.folderId as string) || null;

      if (filesToProcess.length === 0) {
        throw new AppError('No files were uploaded', 400);
      }

      // Enforce total multipart batch limit (100MB) to protect Render Free memory
      const totalBatchSize = filesToProcess.reduce((sum, f) => sum + (f.size || 0), 0);
      if (totalBatchSize > MAX_BATCH_SIZE_BYTES) {
        throw new AppError(
          `Total batch upload size (${(totalBatchSize / (1024 * 1024)).toFixed(1)} MB) exceeds the 100 MB limit`,
          400
        );
      }

      // Memory-safe: pass disk paths for streaming processing without loading all into memory
      const payloads = filesToProcess.map((f) => ({
        originalname: Buffer.from(f.originalname, 'latin1').toString('utf8'),
        mimetype: f.mimetype,
        size: f.size,
        path: f.path,
        buffer: f.buffer,
      }));

      const created = await fileService.uploadFiles(projectId, userId, payloads, { workItemId, noteId, folderId });

      res.status(201).json({
        success: true,
        message: `${created.length} file(s) uploaded successfully`,
        data: { files: created },
      });
    } catch (err) {
      next(err);
    } finally {
      // Clean up temporary files from disk
      for (const f of filesToProcess) {
        if (f.path) {
          fs.promises.unlink(f.path).catch(() => {});
        }
      }
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

      const ext = (file.extension || '').toLowerCase();
      const isHtmlActive = ['html', 'htm', 'xhtml'].includes(ext) || (file.mimeType && file.mimeType.includes('html'));
      const isPotentiallyActive =
        isHtmlActive ||
        ['svg', 'xml', 'js', 'mjs'].includes(ext) ||
        (file.mimeType && (file.mimeType.includes('svg') || file.mimeType.includes('xml')));

      // Dangerous active HTML files are forced to text/plain to completely neutralize script execution
      const servedMimeType = isHtmlActive ? 'text/plain; charset=utf-8' : (file.mimeType || 'application/octet-stream');

      res.setHeader('Content-Type', servedMimeType);
      res.setHeader('Content-Length', file.sizeBytes);
      res.setHeader('X-Content-Type-Options', 'nosniff');

      if (isPotentiallyActive) {
        // Strict CSP sandbox isolates uploaded active formats completely
        res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
      }

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
