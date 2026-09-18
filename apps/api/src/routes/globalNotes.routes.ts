import { Router } from 'express';
import { noteController } from '../controllers/note.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// Require authentication
router.use(authenticate);

// GET /api/notes - Get notes across accessible projects
router.get('/', (req, res, next) => {
  noteController.getGlobalNotes(req as any, res, next);
});

export default router;
