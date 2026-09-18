import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { commentService } from '../services/comment.service.js';
import { AppError } from '../middlewares/error.middleware.js';

export class CommentController {
  async getComments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const projectId = String(req.params.projectId);
      const workItemId = String(req.params.workItemId);
      const comments = await commentService.getComments(req.user.userId, projectId, workItemId);

      res.status(200).json({
        success: true,
        data: { comments },
      });
    } catch (error) {
      next(error);
    }
  }

  async createComment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const projectId = String(req.params.projectId);
      const workItemId = String(req.params.workItemId);
      const comment = await commentService.createComment(req.user.userId, projectId, workItemId, req.body);

      res.status(201).json({
        success: true,
        message: 'Comment added successfully',
        data: { comment },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateComment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const projectId = String(req.params.projectId);
      const commentId = String(req.params.commentId);
      const comment = await commentService.updateComment(req.user.userId, projectId, commentId, req.body);

      res.status(200).json({
        success: true,
        message: 'Comment updated successfully',
        data: { comment },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteComment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const projectId = String(req.params.projectId);
      const commentId = String(req.params.commentId);
      await commentService.deleteComment(req.user.userId, projectId, commentId);

      res.status(200).json({
        success: true,
        message: 'Comment deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const commentController = new CommentController();
