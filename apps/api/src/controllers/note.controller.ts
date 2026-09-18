import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { noteService } from '../services/note.service.js';
import { createNoteSchema, updateNoteSchema, noteQuerySchema } from '../schemas/note.schema.js';
import { AppError } from '../middlewares/error.middleware.js';

export class NoteController {
  async getProjectNotes(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string;
      const userId = req.user.userId;
      const query = noteQuerySchema.parse(req.query);

      const result = await noteService.getProjectNotes(projectId, userId, query);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getGlobalNotes(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const userId = req.user.userId;
      const query = noteQuerySchema.parse(req.query);
      const projectId = req.query.projectId ? (req.query.projectId as string) : undefined;

      const result = await noteService.getGlobalNotes(userId, { ...query, projectId });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getNoteById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string;
      const noteId = req.params.noteId as string;
      const userId = req.user.userId;

      const note = await noteService.getNoteById(projectId, noteId, userId);

      res.status(200).json({
        success: true,
        data: { note },
      });
    } catch (error) {
      next(error);
    }
  }

  async createNote(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string;
      const userId = req.user.userId;
      const validatedData = createNoteSchema.parse(req.body);

      const note = await noteService.createNote(projectId, userId, validatedData);

      res.status(201).json({
        success: true,
        message: 'Note created successfully',
        data: { note },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateNote(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string;
      const noteId = req.params.noteId as string;
      const userId = req.user.userId;
      const validatedData = updateNoteSchema.parse(req.body);

      const note = await noteService.updateNote(projectId, noteId, userId, validatedData);

      res.status(200).json({
        success: true,
        message: 'Note updated successfully',
        data: { note },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteNote(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string;
      const noteId = req.params.noteId as string;
      const userId = req.user.userId;

      const result = await noteService.deleteNote(projectId, noteId, userId);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const noteController = new NoteController();
