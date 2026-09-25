import { Router } from 'express';
import { getLiveness, getReadiness } from '../controllers/health.controller.js';

const router = Router();

router.get('/health', getLiveness);
router.get('/ready', getReadiness);

export default router;
