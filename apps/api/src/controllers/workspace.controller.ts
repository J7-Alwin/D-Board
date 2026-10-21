import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { workspaceService } from '../services/workspace.service.js';
import { workspaceMemberService } from '../services/workspaceMember.service.js';
import { workspaceInvitationService } from '../services/workspaceInvitation.service.js';
import { workspaceOwnershipTransferService } from '../services/workspaceOwnershipTransfer.service.js';
import { workspaceAuditService } from '../services/workspaceAudit.service.js';
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  createWorkspaceInvitationSchema,
  updateWorkspaceAdminPermissionsSchema,
  requestOwnershipTransferSchema,
  acceptOwnershipTransferSchema,
  rejectOwnershipTransferSchema,
  deleteWorkspaceSchema,
  workspaceAuditLogQuerySchema,
} from '../schemas/workspace.schema.js';
import { AppError } from '../middlewares/error.middleware.js';
import type { WorkspaceRole } from '../generated/prisma/index.js';

export class WorkspaceController {
  /**
   * GET /api/workspaces
   * Returns { owned: WorkspaceSummaryDto[], joined: WorkspaceSummaryDto[] }
   */
  async getUserWorkspaces(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const workspaces = await workspaceService.getUserWorkspaces(req.user.userId);
      res.status(200).json({
        success: true,
        data: workspaces,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/workspaces/:workspaceId
   */
  async getWorkspaceById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const workspaceId = req.params.workspaceId as string;
      const workspace = await workspaceService.getWorkspaceById(workspaceId, req.user.userId);
      res.status(200).json({
        success: true,
        data: { workspace },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/workspaces
   * Create a new team workspace with caller as OWNER
   */
  async createWorkspace(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const input = createWorkspaceSchema.parse(req.body);
      const workspace = await workspaceService.createWorkspace(req.user.userId, input);
      res.status(201).json({
        success: true,
        message: 'Workspace created successfully',
        data: { workspace },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/workspaces/:workspaceId
   * Update workspace settings or member limit (Owner only)
   */
  async updateWorkspace(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const workspaceId = req.params.workspaceId as string;
      const input = updateWorkspaceSchema.parse(req.body);
      const workspace = await workspaceService.updateWorkspace(workspaceId, req.user.userId, input, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.status(200).json({
        success: true,
        message: 'Workspace updated successfully',
        data: { workspace },
      });
    } catch (err) {
      next(err);
    }
  }

  // =========================================================================
  // Member Management Endpoints
  // =========================================================================

  /**
   * GET /api/workspaces/:workspaceId/members
   */
  async getWorkspaceMembers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const workspaceId = req.params.workspaceId as string;
      const { page, limit, search, role } = req.query;

      const result = await workspaceMemberService.getWorkspaceMembers(workspaceId, req.user.userId, {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search: search ? String(search) : undefined,
        role: role ? (String(role) as WorkspaceRole) : undefined,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/workspaces/:workspaceId/members/:memberId
   */
  async updateMemberRole(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const { workspaceId, memberId } = req.params;
      const { role } = req.body;

      if (!role || !['WORKSPACE_ADMIN', 'PROJECT_ADMIN', 'WORKSPACE_MEMBER'].includes(role)) {
        throw new AppError('Valid role (WORKSPACE_ADMIN, PROJECT_ADMIN, or WORKSPACE_MEMBER) is required', 400);
      }

      const updated = await workspaceMemberService.updateMemberRole(
        workspaceId as string,
        memberId as string,
        role as WorkspaceRole,
        req.user.userId
      );

      res.status(200).json({
        success: true,
        message: 'Member role updated successfully',
        data: { member: updated },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/workspaces/:workspaceId/members/:memberId
   */
  async removeMember(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const { workspaceId, memberId } = req.params;

      const result = await workspaceMemberService.removeMember(
        workspaceId as string,
        memberId as string,
        req.user.userId
      );

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }

  // =========================================================================
  // Workspace Invitation Endpoints
  // =========================================================================

  /**
   * POST /api/workspaces/:workspaceId/invitations
   */
  async createInvitation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const workspaceId = req.params.workspaceId as string;
      const input = createWorkspaceInvitationSchema.parse(req.body);

      const invitation = await workspaceInvitationService.createInvitation(
        workspaceId,
        req.user.userId,
        input
      );

      res.status(201).json({
        success: true,
        message: 'Workspace invitation sent successfully',
        data: { invitation },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/workspaces/:workspaceId/invitations
   */
  async getWorkspaceInvitations(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const workspaceId = req.params.workspaceId as string;

      const invitations = await workspaceInvitationService.getWorkspaceInvitations(
        workspaceId,
        req.user.userId
      );

      res.status(200).json({
        success: true,
        data: { invitations },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/workspaces/:workspaceId/invitations/:invitationId/resend
   */
  async resendInvitation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const { workspaceId, invitationId } = req.params;

      const updated = await workspaceInvitationService.resendInvitation(
        workspaceId as string,
        invitationId as string,
        req.user.userId
      );

      res.status(200).json({
        success: true,
        message: 'Invitation resent successfully',
        data: { invitation: updated },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/workspaces/:workspaceId/invitations/:invitationId
   */
  async revokeInvitation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const { workspaceId, invitationId } = req.params;

      const result = await workspaceInvitationService.revokeInvitation(
        workspaceId as string,
        invitationId as string,
        req.user.userId
      );

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/workspaces/invitations/pending (Recipient view)
   */
  async getUserPendingInvitations(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const invitations = await workspaceInvitationService.getUserPendingInvitations(req.user.userId);
      res.status(200).json({
        success: true,
        data: { invitations },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/workspaces/invitations/:invitationIdOrToken/accept or POST /api/workspaces/invitations/accept
   */
   async acceptInvitation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
     try {
       if (!req.user) throw new AppError('Authentication required', 401);
       const invitationIdOrToken = (req.params.invitationIdOrToken || req.body?.token || req.body?.invitationId) as string;
       if (!invitationIdOrToken) {
         throw new AppError('Invitation ID or token is required', 400);
       }

       const result = await workspaceInvitationService.acceptInvitation(
         invitationIdOrToken,
         req.user.userId
       );

       res.status(200).json(result);
     } catch (err) {
       next(err);
     }
   }

  /**
   * POST /api/workspaces/invitations/:invitationIdOrToken/decline or POST /api/workspaces/invitations/decline
   */
   async declineInvitation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
     try {
       if (!req.user) throw new AppError('Authentication required', 401);
       const invitationIdOrToken = (req.params.invitationIdOrToken || req.body?.token || req.body?.invitationId) as string;
       if (!invitationIdOrToken) {
         throw new AppError('Invitation ID or token is required', 400);
       }

       const result = await workspaceInvitationService.declineInvitation(
         invitationIdOrToken,
         req.user.userId
       );

       res.status(200).json(result);
     } catch (err) {
       next(err);
     }
   }

  // =========================================================================
  // Owner-Controlled Admin Permissions Endpoints
  // =========================================================================

  /**
   * GET /api/workspaces/:workspaceId/admin-permissions
   */
  async getAdminPermissions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const workspaceId = req.params.workspaceId as string;

      const permissions = await workspaceService.getAdminPermissions(workspaceId, req.user.userId);
      res.status(200).json({
        success: true,
        data: { permissions },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/workspaces/:workspaceId/admin-permissions
   */
  async updateAdminPermissions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const workspaceId = req.params.workspaceId as string;
      const input = updateWorkspaceAdminPermissionsSchema.parse(req.body);

      const permissions = await workspaceService.updateAdminPermissions(
        workspaceId,
        req.user.userId,
        input
      );

      res.status(200).json({
        success: true,
        message: 'Admin permissions updated successfully',
        data: { permissions },
      });
    } catch (err) {
      next(err);
    }
  }

  // =========================================================================
  // Workspace Ownership Transfer Endpoints (Phase 5A)
  // =========================================================================

  /**
   * POST /api/workspaces/:workspaceId/ownership-transfer/request
   */
  async requestOwnershipTransfer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const workspaceId = req.params.workspaceId as string;
      const input = requestOwnershipTransferSchema.parse(req.body);

      const transfer = await workspaceOwnershipTransferService.requestTransfer(
        workspaceId,
        req.user.userId,
        input,
        { ipAddress: req.ip, userAgent: req.get('user-agent') }
      );

      res.status(201).json({
        success: true,
        message: 'Ownership transfer request initiated successfully',
        data: { transfer },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/workspaces/:workspaceId/ownership-transfer
   */
  async getPendingOwnershipTransfer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const workspaceId = req.params.workspaceId as string;

      const transfer = await workspaceOwnershipTransferService.getPendingTransfer(
        workspaceId,
        req.user.userId
      );

      res.status(200).json({
        success: true,
        data: { transfer },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/workspaces/:workspaceId/ownership-transfer/cancel
   */
  async cancelOwnershipTransfer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const workspaceId = req.params.workspaceId as string;

      const result = await workspaceOwnershipTransferService.cancelTransfer(
        workspaceId,
        req.user.userId,
        { ipAddress: req.ip, userAgent: req.get('user-agent') }
      );

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/workspaces/:workspaceId/ownership-transfer/reject
   */
  async rejectOwnershipTransfer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const workspaceId = req.params.workspaceId as string;
      const input = rejectOwnershipTransferSchema.parse(req.body || {});

      const result = await workspaceOwnershipTransferService.rejectTransfer(
        workspaceId,
        req.user.userId,
        input.token,
        { ipAddress: req.ip, userAgent: req.get('user-agent') }
      );

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/workspaces/:workspaceId/ownership-transfer/accept
   */
  async acceptOwnershipTransfer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const workspaceId = req.params.workspaceId as string;
      const input = acceptOwnershipTransferSchema.parse(req.body || {});

      const result = await workspaceOwnershipTransferService.acceptTransfer(
        workspaceId,
        req.user.userId,
        input.token,
        { ipAddress: req.ip, userAgent: req.get('user-agent') }
      );

      res.status(200).json({
        success: true,
        message: result.message,
        data: { workspaceId: result.workspaceId },
      });
    } catch (err) {
      next(err);
    }
  }

  // =========================================================================
  // Workspace Soft Deletion & Recovery Endpoints (Phase 5B)
  // =========================================================================

  /**
   * POST /api/workspaces/:workspaceId/delete (or DELETE /api/workspaces/:workspaceId)
   */
  async deleteWorkspace(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const workspaceId = req.params.workspaceId as string;
      const input = deleteWorkspaceSchema.parse(req.body);

      const result = await workspaceService.deleteWorkspace(
        workspaceId,
        req.user.userId,
        input.confirmationName,
        { ipAddress: req.ip, userAgent: req.get('user-agent') }
      );

      res.status(200).json({
        success: true,
        message: result.message,
        data: { deletionScheduledAt: result.deletionScheduledAt },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/workspaces/:workspaceId/recover
   */
  async recoverWorkspace(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const workspaceId = req.params.workspaceId as string;

      const result = await workspaceService.recoverWorkspace(
        workspaceId,
        req.user.userId,
        { ipAddress: req.ip, userAgent: req.get('user-agent') }
      );

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/workspaces/deleted
   */
  async getDeletedWorkspaces(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const workspaces = await workspaceService.getDeletedWorkspaces(req.user.userId);

      res.status(200).json({
        success: true,
        data: { workspaces },
      });
    } catch (err) {
      next(err);
    }
  }

  // =========================================================================
  // Workspace Audit Trail Endpoint (Phase 5C)
  // =========================================================================

  /**
   * GET /api/workspaces/:workspaceId/audit-logs
   */
  async getWorkspaceAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const workspaceId = req.params.workspaceId as string;
      const query = workspaceAuditLogQuerySchema.parse(req.query);

      const result = await workspaceAuditService.getWorkspaceAuditLogs(
        workspaceId,
        req.user.userId,
        query
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/workspaces/:workspaceId/leave
   * Voluntarily leave a workspace (Non-owners only)
   */
  async leaveWorkspace(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const workspaceId = req.params.workspaceId as string;
      const result = await workspaceMemberService.leaveWorkspace(workspaceId, req.user.userId);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/workspaces/:workspaceId/clear-data
   * Reset sandbox / clear all data in personal workspace
   */
  async clearPersonalWorkspaceData(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const workspaceId = req.params.workspaceId as string;
      const result = await workspaceService.clearPersonalWorkspaceData(workspaceId, req.user.userId);
      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/workspaces/:workspaceId/deletion-request
   * Workspace Admin requests workspace deletion
   */
  async requestWorkspaceDeletion(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const workspaceId = req.params.workspaceId as string;
      const { reason } = req.body || {};
      const result = await workspaceService.requestWorkspaceDeletion(workspaceId, req.user.userId, reason);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/workspaces/:workspaceId/deletion-request
   * Fetch current deletion request status
   */
  async getWorkspaceDeletionRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const workspaceId = req.params.workspaceId as string;
      const result = await workspaceService.getWorkspaceDeletionRequest(workspaceId, req.user.userId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/workspaces/:workspaceId/deletion-request/decline
   * Owner declines deletion request
   */
  async declineWorkspaceDeletionRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const workspaceId = req.params.workspaceId as string;
      const { reason } = req.body || {};
      const result = await workspaceService.declineWorkspaceDeletionRequest(workspaceId, req.user.userId, reason);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/workspaces/:workspaceId/deletion-request
   * Requester or Owner cancels deletion request
   */
  async cancelWorkspaceDeletionRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const workspaceId = req.params.workspaceId as string;
      const result = await workspaceService.cancelWorkspaceDeletionRequest(workspaceId, req.user.userId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const workspaceController = new WorkspaceController();
