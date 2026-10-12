import { Router } from 'express';
import { fileController } from '../controllers/file.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { resolveWorkspaceContext } from '../middlewares/workspace.middleware.js';

export const globalFilesRoutes: Router = Router();

// Require authentication for all global file queries
globalFilesRoutes.use(authenticate);
globalFilesRoutes.use(resolveWorkspaceContext);

// Storage stats for current user
globalFilesRoutes.get('/storage/stats', (req, res, next) => {
  fileController.getStorageStats(req as any, res, next);
});

// Cross-project files aggregator
globalFilesRoutes.get('/', (req, res, next) => {
  fileController.getGlobalFiles(req as any, res, next);
});
