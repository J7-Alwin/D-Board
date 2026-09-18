import { Router } from 'express';
import { workController } from '../controllers/work.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/my', workController.getMyWorkItems);

export const globalWorkRoutes = router;
