import { Router } from 'express';
import { fileController } from '../controllers/file.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

export const globalFilesRoutes: Router = Router();

// Require authentication for all global file queries
globalFilesRoutes.use(authenticate);

// Storage stats for current user
globalFilesRoutes.get('/storage/stats', fileController.getStorageStats);

// Cross-project files aggregator
globalFilesRoutes.get('/', fileController.getGlobalFiles);
