import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { resolveWorkspaceContext } from '../middlewares/workspace.middleware.js';
import { activityController } from '../controllers/activity.controller.js';

const router = Router();

router.use(authenticate);
router.use(resolveWorkspaceContext);
router.get('/', (req, res, next) => {
  activityController.getGlobalActivities(req as any, res, next);
});

export const globalActivityRoutes = router;
