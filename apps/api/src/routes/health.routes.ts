import { Router } from 'express';
import { getLiveness, getReadiness, handleDatabaseKeepalive } from '../controllers/health.controller.js';
import { createRateLimiter } from '../middlewares/rateLimit.middleware.js';

const router = Router();

// Protect keepalive endpoints against brute-force or DoS query flood attacks
const keepaliveRateLimiter = createRateLimiter({
  windowSeconds: 60,
  maxRequests: 30,
  prefix: 'keepalive',
  message: 'Keepalive rate limit exceeded. Please limit automated health pings.',
});

router.get('/health', getLiveness);
router.get('/ready', getReadiness);

// Dedicated database keepalive endpoints for cron jobs, uptime monitors, and scheduled webhooks
router.get('/health/db-ping', keepaliveRateLimiter, handleDatabaseKeepalive);
router.post('/health/db-ping', keepaliveRateLimiter, handleDatabaseKeepalive);
router.get('/cron/keepalive', keepaliveRateLimiter, handleDatabaseKeepalive);
router.post('/cron/keepalive', keepaliveRateLimiter, handleDatabaseKeepalive);
router.get('/keepalive', keepaliveRateLimiter, handleDatabaseKeepalive);
router.post('/keepalive', keepaliveRateLimiter, handleDatabaseKeepalive);

export default router;
