import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { activityController } from '../controllers/activity.controller.js';

const router = Router();

router.use(authenticate);
router.get('/', activityController.getGlobalActivities);

export const globalActivityRoutes = router;
