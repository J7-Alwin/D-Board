import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { resolveWorkspaceContext } from '../middlewares/workspace.middleware.js';
import { searchGlobalHandler } from '../controllers/search.controller.js';

const router = Router();

router.use(authenticate);
router.use(resolveWorkspaceContext);
router.get('/', searchGlobalHandler);

export const searchRoutes = router;
