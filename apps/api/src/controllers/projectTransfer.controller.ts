import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { projectTransferService } from '../services/projectTransfer.service.js';
import {
  requestProjectTransferSchema,
  rejectProjectTransferSchema,
} from '../schemas/projectTransfer.schema.js';
import { AppError } from '../middlewares/error.middleware.js';

export class ProjectTransferController {
  /**
   * GET /api/projects/:projectId/transfer-eligibility
   */
  async getTransferEligibility(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string;

      const eligibility = await projectTransferService.getTransferEligibility(
        projectId,
        req.user.userId
      );

      res.status(200).json({
        success: true,
        data: eligibility,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/projects/:projectId/transfer
   */
  async requestTransfer(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string;
      const input = requestProjectTransferSchema.parse(req.body);

      const result = await projectTransferService.requestTransfer(
        projectId,
        req.user.userId,
        input
      );

      res.status(result.executedImmediately ? 200 : 201).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/projects/:projectId/transfers
   */
  async getProjectTransfers(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const projectId = req.params.projectId as string;

      const transfers = await projectTransferService.getProjectTransfers(
        projectId,
        req.user.userId
      );

      res.status(200).json({
        success: true,
        data: { transfers },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/workspaces/:workspaceId/transfers/pending
   */
  async getWorkspacePendingTransfers(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const workspaceId = req.params.workspaceId as string;

      const pending = await projectTransferService.getWorkspacePendingTransfers(
        workspaceId,
        req.user.userId
      );

      res.status(200).json({
        success: true,
        data: pending,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/transfers/:transferId/approve
   */
  async approveTransfer(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const transferId = req.params.transferId as string;

      const result = await projectTransferService.approveTransfer(
        transferId,
        req.user.userId
      );

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/transfers/:transferId/reject
   */
  async rejectTransfer(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const transferId = req.params.transferId as string;
      const input = rejectProjectTransferSchema.parse(req.body);

      const result = await projectTransferService.rejectTransfer(
        transferId,
        req.user.userId,
        input
      );

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/transfers/:transferId/cancel
   */
  async cancelTransfer(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const transferId = req.params.transferId as string;

      const result = await projectTransferService.cancelTransfer(
        transferId,
        req.user.userId
      );

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/transfers/:transferId
   */
  async getTransferDetails(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const transferId = req.params.transferId as string;

      const transfer = await projectTransferService.getTransferDetails(
        transferId,
        req.user.userId
      );

      res.status(200).json({
        success: true,
        data: transfer,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const projectTransferController = new ProjectTransferController();
