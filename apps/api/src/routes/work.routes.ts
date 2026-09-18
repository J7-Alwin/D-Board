import { Router } from 'express';
import { workController } from '../controllers/work.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createWorkItemSchema, updateWorkItemSchema } from '../schemas/work.schema.js';
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

export const workRoutes = router;
