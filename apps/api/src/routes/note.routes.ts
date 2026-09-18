import { Router } from 'express';
import { noteController } from '../controllers/note.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router({ mergeParams: true });

// Require authentication for all note endpoints
router.use(authenticate);

router.get('/', (req, res, next) => {
  noteController.getProjectNotes(req as any, res, next);
});

router.post('/', (req, res, next) => {
  noteController.createNote(req as any, res, next);
});

router.get('/:noteId', (req, res, next) => {
  noteController.getNoteById(req as any, res, next);
});

router.patch('/:noteId', (req, res, next) => {
  noteController.updateNote(req as any, res, next);
});

router.delete('/:noteId', (req, res, next) => {
  noteController.deleteNote(req as any, res, next);
});

export default router;
