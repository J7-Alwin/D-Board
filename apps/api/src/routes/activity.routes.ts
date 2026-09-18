import { Router } from 'express';
import { activityController } from '../controllers/activity.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/', activityController.getProjectActivities);

export const activityRoutes = router;
