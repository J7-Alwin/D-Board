import { Router } from 'express';
import { calendarController } from '../controllers/calendar.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);

// GET /api/calendar/events - Get unified calendar items across accessible projects
router.get('/events', (req, res, next) => {
  calendarController.getGlobalCalendar(req as any, res, next);
});

export default router;
