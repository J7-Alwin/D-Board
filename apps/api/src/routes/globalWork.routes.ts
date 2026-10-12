import { Router } from 'express';
import { workController } from '../controllers/work.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { resolveWorkspaceContext } from '../middlewares/workspace.middleware.js';

const router = Router();

router.use(authenticate);
router.use(resolveWorkspaceContext);

router.get('/my', (req, res, next) => {
  workController.getMyWorkItems(req as any, res, next);
});

export const globalWorkRoutes = router;
