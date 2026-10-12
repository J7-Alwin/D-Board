import { Router } from 'express';
import { noteController } from '../controllers/note.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { resolveWorkspaceContext } from '../middlewares/workspace.middleware.js';

const router = Router();

// Require authentication and workspace context
router.use(authenticate);
router.use(resolveWorkspaceContext);

// GET /api/notes - Get notes across accessible projects in active workspace
router.get('/', (req, res, next) => {
  noteController.getGlobalNotes(req as any, res, next);
});

export default router;
