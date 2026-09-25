import { Router } from 'express';
import { fileController, uploadMiddleware } from '../controllers/file.controller.js';
import { uploadRateLimiter } from '../middlewares/rateLimit.middleware.js';

export const fileRoutes: Router = Router({ mergeParams: true });

// Upload files with dedicated upload rate limiter
fileRoutes.post('/', uploadRateLimiter, uploadMiddleware.array('files', 10), fileController.uploadFiles);

// List project files
fileRoutes.get('/', fileController.getProjectFiles);

// Get single file metadata
fileRoutes.get('/:fileId', fileController.getFileById);

// Stream raw content for in-platform viewer
fileRoutes.get('/:fileId/content', fileController.getFileContent);

// Download file (forced attachment)
fileRoutes.get('/:fileId/download', fileController.downloadFile);

// Rename file
fileRoutes.patch('/:fileId/rename', fileController.renameFile);

// Delete file
fileRoutes.delete('/:fileId', fileController.deleteFile);

// Attach/detach to work item
fileRoutes.post('/:fileId/attach', fileController.attachToWorkItem);
