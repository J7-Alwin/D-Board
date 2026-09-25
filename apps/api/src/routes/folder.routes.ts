import { Router } from 'express';
import { folderController } from '../controllers/folder.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

// GET /api/projects/:projectId/folders
router.get('/', (req, res, next) => {
  folderController.getProjectFolders(req as any, res, next);
});

// POST /api/projects/:projectId/folders
router.post('/', (req, res, next) => {
  folderController.createFolder(req as any, res, next);
});

// PATCH /api/projects/:projectId/folders/:folderId
router.patch('/:folderId', (req, res, next) => {
  folderController.renameFolder(req as any, res, next);
});

// DELETE /api/projects/:projectId/folders/:folderId
router.delete('/:folderId', (req, res, next) => {
  folderController.deleteFolder(req as any, res, next);
});

export default router;
