import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { memberService } from '../services/member.service.js';
import { AppError } from '../middlewares/error.middleware.js';

export class MemberController {
  async getProjectMembers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const projectId = String(req.params.projectId);
      const result = await memberService.getProjectMembers(projectId, req.user.userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateMemberRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const projectId = String(req.params.projectId);
      const memberId = String(req.params.memberId);
      const { role } = req.body;

      const updated = await memberService.updateMemberRole(projectId, memberId, role, req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Member role updated successfully',
        data: { member: updated },
      });
    } catch (error) {
      next(error);
    }
  }

  async removeMember(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const projectId = String(req.params.projectId);
      const memberId = String(req.params.memberId);

      const result = await memberService.removeMember(projectId, memberId, req.user.userId);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const memberController = new MemberController();
