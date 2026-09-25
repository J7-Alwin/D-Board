import { Router } from 'express';
import { calendarController } from '../controllers/calendar.controller.js';
import { authenticate, optionalAuthenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// GET /api/calendar/feed.ics - Subscribe to live iCalendar feed (Supports revocable ?token=... or session cookie)
router.get('/feed.ics', optionalAuthenticate, (req, res, next) => {
  calendarController.getICalFeed(req as any, res, next);
});

router.use(authenticate);

// Feed subscription token management
router.post('/feed/token', (req, res, next) => {
  calendarController.createFeedToken(req as any, res, next);
});

router.delete('/feed/token', (req, res, next) => {
  calendarController.revokeFeedToken(req as any, res, next);
});

// GET /api/calendar/events - Get unified calendar items across accessible projects
router.get('/events', (req, res, next) => {
  calendarController.getGlobalCalendar(req as any, res, next);
});

export default router;
