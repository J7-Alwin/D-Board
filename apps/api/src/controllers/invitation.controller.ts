import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { invitationService } from '../services/invitation.service.js';
import { AppError } from '../middlewares/error.middleware.js';

export class InvitationController {
  async createInvitation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const projectId = String(req.params.projectId);
      const invitation = await invitationService.createInvitation(projectId, req.user.userId, req.body);

      res.status(201).json({
        success: true,
        message: 'Invitation sent successfully',
        data: { invitation },
      });
    } catch (error) {
      next(error);
    }
  }

  async getProjectInvitations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const projectId = String(req.params.projectId);
      const invitations = await invitationService.getProjectInvitations(projectId, req.user.userId);

      res.status(200).json({
        success: true,
        data: { invitations },
      });
    } catch (error) {
      next(error);
    }
  }

  async resendInvitation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const projectId = String(req.params.projectId);
      const invitationId = String(req.params.invitationId);
      const invitation = await invitationService.resendInvitation(projectId, invitationId, req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Invitation resent successfully',
        data: { invitation },
      });
    } catch (error) {
      next(error);
    }
  }

  async cancelInvitation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const projectId = String(req.params.projectId);
      const invitationId = String(req.params.invitationId);
      const invitation = await invitationService.cancelInvitation(projectId, invitationId, req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Invitation cancelled',
        data: { invitation },
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserInvitations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const status = req.query.status ? String(req.query.status) : undefined;
      const invitations = await invitationService.getUserInvitations(req.user.userId, status);

      res.status(200).json({
        success: true,
        data: { invitations },
      });
    } catch (error) {
      next(error);
    }
  }

  async acceptInvitation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const invitationId = String(req.params.invitationId);
      const result = await invitationService.acceptInvitation(invitationId, req.user.userId);

      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async declineInvitation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const invitationId = String(req.params.invitationId);
      const result = await invitationService.declineInvitation(invitationId, req.user.userId);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPendingCount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const result = await invitationService.getPendingCount(req.user.userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const invitationController = new InvitationController();
