import { Router } from 'express';
import { calendarController } from '../controllers/calendar.controller.js';
import { authenticate, optionalAuthenticate } from '../middlewares/auth.middleware.js';

const router = Router({ mergeParams: true });

// GET /api/projects/:projectId/calendar/feed.ics (Supports revocable ?token=... or session cookie)
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

// GET /api/projects/:projectId/calendar/events
router.get('/events', (req, res, next) => {
  calendarController.getProjectCalendar(req as any, res, next);
});

// POST /api/projects/:projectId/calendar/events
router.post('/events', (req, res, next) => {
  calendarController.createCalendarEvent(req as any, res, next);
});

// GET /api/projects/:projectId/calendar/events/:eventId
router.get('/events/:eventId', (req, res, next) => {
  calendarController.getCalendarEventById(req as any, res, next);
});

// PATCH /api/projects/:projectId/calendar/events/:eventId
router.patch('/events/:eventId', (req, res, next) => {
  calendarController.updateCalendarEvent(req as any, res, next);
});

// DELETE /api/projects/:projectId/calendar/events/:eventId
router.delete('/events/:eventId', (req, res, next) => {
  calendarController.deleteCalendarEvent(req as any, res, next);
});

export default router;
