import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { resolveWorkspaceContext } from '../middlewares/workspace.middleware.js';

const router = Router();

router.use(authenticate);
router.use(resolveWorkspaceContext);

router.get('/', (req, res, next) => {
  dashboardController.getDashboard(req as any, res, next);
});

export const dashboardRoutes = router;
