import { Router } from 'express';
import { workController } from '../controllers/work.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createWorkItemSchema, updateWorkItemSchema, reviewTaskSchema } from '../schemas/work.schema.js';
import { commentRoutes } from './comment.routes.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

// Mount nested comments route under /:workItemId/comments
router.use('/:workItemId/comments', commentRoutes);

router.post('/', validate(createWorkItemSchema), workController.createWorkItem);
router.get('/', workController.getProjectWorkItems);
router.get('/:workItemId', workController.getWorkItemById);
router.patch('/:workItemId', validate(updateWorkItemSchema), workController.updateWorkItem);
router.delete('/:workItemId', workController.deleteWorkItem);

// Workflow stage action routes
router.post('/:workItemId/start', workController.startTask);
router.post('/:workItemId/pause-timer', workController.pauseTimer);
router.post('/:workItemId/check-in', workController.checkInTimer);
router.post('/:workItemId/resume-timer', workController.resumeTimer);
router.post('/:workItemId/complete-work', workController.completeWork);
router.post('/:workItemId/review', validate(reviewTaskSchema), workController.reviewTask);

export const workRoutes = router;

