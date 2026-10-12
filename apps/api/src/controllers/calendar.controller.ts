import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { calendarService } from '../services/calendar.service.js';
import {
  createCalendarEventSchema,
  updateCalendarEventSchema,
  calendarQuerySchema,
} from '../schemas/calendar.schema.js';
import { AppError } from '../middlewares/error.middleware.js';

export class CalendarController {
  async getGlobalCalendar(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const query = calendarQuerySchema.parse(req.query);
      const workspaceId = (req as any).workspaceId || (req.query?.workspaceId as string) || (req.headers['x-workspace-id'] as string);

      const result = await calendarService.getCalendarItems(req.user.userId, query, workspaceId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProjectCalendar(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string;
      const query = calendarQuerySchema.parse(req.query);

      const result = await calendarService.getCalendarItems(req.user.userId, {
        ...query,
        projectId,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCalendarEventById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string;
      const eventId = req.params.eventId as string;

      const event = await calendarService.getCalendarEventById(projectId, eventId, req.user.userId);

      res.status(200).json({
        success: true,
        data: { event },
      });
    } catch (error) {
      next(error);
    }
  }

  async createCalendarEvent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string;
      const validatedData = createCalendarEventSchema.parse(req.body);

      const event = await calendarService.createCalendarEvent(
        projectId,
        req.user.userId,
        validatedData
      );

      res.status(201).json({
        success: true,
        message: 'Calendar event created successfully',
        data: { event },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateCalendarEvent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string;
      const eventId = req.params.eventId as string;
      const validatedData = updateCalendarEventSchema.parse(req.body);

      const event = await calendarService.updateCalendarEvent(
        projectId,
        eventId,
        req.user.userId,
        validatedData
      );

      res.status(200).json({
        success: true,
        message: 'Calendar event updated successfully',
        data: { event },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteCalendarEvent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string;
      const eventId = req.params.eventId as string;

      const result = await calendarService.deleteCalendarEvent(
        projectId,
        eventId,
        req.user.userId
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getICalFeed(req: any, res: Response, next: NextFunction): Promise<void> {
    try {
      const projectId = req.params?.projectId as string | undefined;
      const rawToken = req.query?.token as string | undefined;

      let effectiveUserId: string;
      let effectiveWorkspaceId: string | undefined;
      let effectiveProjectId: string | undefined = projectId;

      if (rawToken && typeof rawToken === 'string' && rawToken.trim()) {
        // Authenticate via high-entropy revocable feed token with scoped workspace isolation
        const feedAuth = await calendarService.authenticateFeedToken(rawToken.trim(), projectId);
        effectiveUserId = feedAuth.userId;
        effectiveWorkspaceId = feedAuth.workspaceId;
        effectiveProjectId = feedAuth.projectId || projectId;
      } else if (req.user?.userId) {
        // Fallback to active browser session (verified by resolveWorkspaceContext)
        effectiveUserId = req.user.userId;
        effectiveWorkspaceId = (req as any).workspaceId;
      } else {
        throw new AppError('Authentication or valid calendar feed subscription token required', 401);
      }

      const icsString = await calendarService.generateICalFeed(effectiveUserId, effectiveProjectId, effectiveWorkspaceId);

      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', 'inline; filename="feed.ics"');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('Cache-Control', 'no-cache, no-store, private');
      res.status(200).send(icsString);
    } catch (error) {
      next(error);
    }
  }

  async createFeedToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string | undefined;
      const workspaceId = (req as any).workspaceId as string | undefined;

      const result = await calendarService.createFeedToken(req.user.userId, projectId || null, workspaceId || null);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async revokeFeedToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string | undefined;
      const workspaceId = (req as any).workspaceId as string | undefined;

      const result = await calendarService.revokeFeedToken(req.user.userId, projectId || null, workspaceId || null);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const calendarController = new CalendarController();
