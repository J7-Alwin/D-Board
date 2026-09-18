import { Router } from 'express';
import { commentController } from '../controllers/comment.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createCommentSchema, updateCommentSchema } from '../schemas/comment.schema.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/', commentController.getComments);
router.post('/', validate(createCommentSchema), commentController.createComment);
router.patch('/:commentId', validate(updateCommentSchema), commentController.updateComment);
router.delete('/:commentId', commentController.deleteComment);

export const commentRoutes = router;
