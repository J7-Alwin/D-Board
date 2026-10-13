import crypto from 'node:crypto';
import prisma from '../prisma.js';
import { AppError } from '../middlewares/error.middleware.js';
import { workspaceAuditService } from './workspaceAudit.service.js';
import { cacheService } from '../redis/cache.service.js';
import * as realtimeService from '../realtime/realtime.service.js';
import type { RequestOwnershipTransferInput } from '../schemas/workspace.schema.js';
import type { WorkspaceRole, WorkspaceOwnershipTransferStatus } from '../generated/prisma/index.js';

export interface OwnershipTransferDto {
  id: string;
  workspaceId: string;
  sourceOwnerId: string;
  targetUserId: string;
  targetRole: WorkspaceRole;
  status: WorkspaceOwnershipTransferStatus;
  expiresAt: Date;
  createdAt: Date;
  sourceOwner: {
    id: string;
    fullName: string | null;
    username: string;
    email: string;
    avatarUrl: string | null;
  };
  targetUser: {
    id: string;
    fullName: string | null;
    username: string;
    email: string;
    avatarUrl: string | null;
  };
}

export class WorkspaceOwnershipTransferService {
  /**
   * Request ownership transfer to an identifiable, email-verified user.
   * Strictly Owner only. Blocked on personal workspaces.
   */
  async requestTransfer(
    workspaceId: string,
    sourceOwnerId: string,
    input: RequestOwnershipTransferInput,
    reqMeta?: { ipAddress?: string; userAgent?: string }
  ): Promise<OwnershipTransferDto> {
    if (!workspaceId) throw new AppError('Workspace ID is required', 400);

    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        owner: { select: { id: true, fullName: true, username: true, email: true, avatarUrl: true } },
      },
    });

    if (!ws) throw new AppError('Workspace not found', 404);
    if (ws.deletedAt) throw new AppError('Cannot transfer ownership of a deleted workspace', 400);

    if (ws.isPersonal) {
      throw new AppError(
        'Personal workspaces cannot be transferred. To collaborate or transfer ownership, please use a team workspace.',
        400
      );
    }

    if (ws.ownerId !== sourceOwnerId) {
      throw new AppError('Only the current workspace owner can initiate an ownership transfer', 403);
    }

    // Resolve target recipient
    let targetUser: any = null;
    if (input.targetUserId) {
      targetUser = await prisma.user.findUnique({
        where: { id: input.targetUserId },
        select: { id: true, fullName: true, username: true, email: true, avatarUrl: true, isEmailVerified: true },
      });
    } else if (input.targetEmail) {
      const normalizedEmail = input.targetEmail.toLowerCase().trim();
      targetUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, fullName: true, username: true, email: true, avatarUrl: true, isEmailVerified: true },
      });
    }

    if (!targetUser) {
      throw new AppError('The recipient user account could not be found. Recipient must be a registered D-Board user.', 404);
    }

    if (!targetUser.isEmailVerified) {
      throw new AppError('The recipient user has not verified their email address. Ownership cannot be transferred to unverified accounts.', 400);
    }

    if (targetUser.id === ws.ownerId) {
      throw new AppError('The recipient is already the owner of this workspace', 400);
    }

    // Check for existing pending transfer
    const existingPending = await prisma.workspaceOwnershipTransfer.findFirst({
      where: {
        workspaceId,
        status: 'PENDING',
      },
    });

    if (existingPending) {
      if (existingPending.expiresAt > new Date()) {
        throw new AppError(
          'An ownership transfer is already pending for this workspace. Please cancel or await the current request before initiating another.',
          409
        );
      } else {
        // Stale expired transfer; mark as expired
        await prisma.workspaceOwnershipTransfer.update({
          where: { id: existingPending.id },
          data: { status: 'EXPIRED' },
        });
      }
    }

    // Generate high-entropy unguessable token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // 7-day expiration
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const created = await prisma.$transaction(async (tx) => {
      const transfer = await tx.workspaceOwnershipTransfer.create({
        data: {
          workspaceId,
          sourceOwnerId,
          targetUserId: targetUser.id,
          targetRole: input.targetRole,
          status: 'PENDING',
          tokenHash,
          expiresAt,
        },
        include: {
          sourceOwner: { select: { id: true, fullName: true, username: true, email: true, avatarUrl: true } },
          targetUser: { select: { id: true, fullName: true, username: true, email: true, avatarUrl: true } },
        },
      });

      await workspaceAuditService.logAuditEvent(tx, {
        workspaceId,
        actorId: sourceOwnerId,
        action: 'OWNERSHIP_TRANSFER_REQUESTED',
        targetType: 'USER',
        targetId: targetUser.id,
        metadata: {
          targetUserId: targetUser.id,
          targetEmail: targetUser.email,
          targetRole: input.targetRole,
          expiresAt,
        },
        ipAddress: reqMeta?.ipAddress,
        userAgent: reqMeta?.userAgent,
      });

      // In-app notification for the recipient
      await tx.notification.create({
        data: {
          recipientId: targetUser.id,
          actorId: sourceOwnerId,
          type: 'INVITATION_ACCEPTED', // High priority banner notification
          title: 'Workspace Ownership Transfer Request',
          message: `${ws.owner?.fullName || ws.owner?.username || 'The owner'} has invited you to take ownership of workspace "${ws.name}".`,
          link: '/app/dashboard',
        },
      });

      return transfer;
    });

    return {
      id: created.id,
      workspaceId: created.workspaceId,
      sourceOwnerId: created.sourceOwnerId,
      targetUserId: created.targetUserId,
      targetRole: created.targetRole,
      status: created.status,
      expiresAt: created.expiresAt,
      createdAt: created.createdAt,
      sourceOwner: created.sourceOwner,
      targetUser: created.targetUser,
    };
  }

  /**
   * Get the current pending ownership transfer for a workspace.
   */
  async getPendingTransfer(workspaceId: string, userId: string): Promise<OwnershipTransferDto | null> {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: { where: { userId } },
      },
    });

    if (!ws) throw new AppError('Workspace not found', 404);

    const isOwner = ws.ownerId === userId;
    const isMember = ws.members.length > 0;

    const pending = await prisma.workspaceOwnershipTransfer.findFirst({
      where: {
        workspaceId,
        status: 'PENDING',
      },
      include: {
        sourceOwner: { select: { id: true, fullName: true, username: true, email: true, avatarUrl: true } },
        targetUser: { select: { id: true, fullName: true, username: true, email: true, avatarUrl: true } },
      },
    });

    if (!pending) return null;

    // Check expiry
    if (pending.expiresAt <= new Date()) {
      await prisma.workspaceOwnershipTransfer.update({
        where: { id: pending.id },
        data: { status: 'EXPIRED' },
      });
      return null;
    }

    const isTarget = pending.targetUserId === userId;
    if (!isOwner && !isMember && !isTarget) {
      throw new AppError('You are not authorized to view this transfer request', 403);
    }

    return {
      id: pending.id,
      workspaceId: pending.workspaceId,
      sourceOwnerId: pending.sourceOwnerId,
      targetUserId: pending.targetUserId,
      targetRole: pending.targetRole,
      status: pending.status,
      expiresAt: pending.expiresAt,
      createdAt: pending.createdAt,
      sourceOwner: pending.sourceOwner,
      targetUser: pending.targetUser,
    };
  }

  /**
   * Cancel a pending ownership transfer (Owner only).
   */
  async cancelTransfer(
    workspaceId: string,
    sourceOwnerId: string,
    reqMeta?: { ipAddress?: string; userAgent?: string }
  ): Promise<{ success: boolean; message: string }> {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!ws) throw new AppError('Workspace not found', 404);
    if (ws.ownerId !== sourceOwnerId) {
      throw new AppError('Only the workspace owner can cancel an ownership transfer', 403);
    }

    const pending = await prisma.workspaceOwnershipTransfer.findFirst({
      where: { workspaceId, status: 'PENDING' },
    });

    if (!pending) {
      throw new AppError('No pending ownership transfer found for this workspace', 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.workspaceOwnershipTransfer.update({
        where: { id: pending.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      });

      await workspaceAuditService.logAuditEvent(tx, {
        workspaceId,
        actorId: sourceOwnerId,
        action: 'OWNERSHIP_TRANSFER_CANCELLED',
        targetType: 'TRANSFER',
        targetId: pending.id,
        metadata: {
          transferId: pending.id,
          targetUserId: pending.targetUserId,
        },
        ipAddress: reqMeta?.ipAddress,
        userAgent: reqMeta?.userAgent,
      });
    });

    return { success: true, message: 'Ownership transfer request cancelled successfully' };
  }

  /**
   * Reject a pending ownership transfer (Recipient only).
   */
  async rejectTransfer(
    workspaceId: string,
    recipientUserId: string,
    token?: string,
    reqMeta?: { ipAddress?: string; userAgent?: string }
  ): Promise<{ success: boolean; message: string }> {
    const pending = await prisma.workspaceOwnershipTransfer.findFirst({
      where: { workspaceId, status: 'PENDING' },
    });

    if (!pending) {
      throw new AppError('No pending ownership transfer found for this workspace', 404);
    }

    let isAuthorized = pending.targetUserId === recipientUserId;
    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      if (tokenHash === pending.tokenHash) isAuthorized = true;
    }

    if (!isAuthorized) {
      throw new AppError('You are not authorized to reject this transfer', 403);
    }

    await prisma.$transaction(async (tx) => {
      await tx.workspaceOwnershipTransfer.update({
        where: { id: pending.id },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
        },
      });

      await workspaceAuditService.logAuditEvent(tx, {
        workspaceId,
        actorId: recipientUserId,
        action: 'OWNERSHIP_TRANSFER_REJECTED',
        targetType: 'TRANSFER',
        targetId: pending.id,
        metadata: {
          transferId: pending.id,
          recipientUserId,
        },
        ipAddress: reqMeta?.ipAddress,
        userAgent: reqMeta?.userAgent,
      });
    });

    return { success: true, message: 'Ownership transfer request declined' };
  }

  /**
   * Accept an ownership transfer atomically with pessimistic row locking.
   * Updates workspace ownership, transfers roles, and invalidates former owner's OWNER status.
   */
  async acceptTransfer(
    workspaceId: string,
    recipientUserId: string,
    token?: string,
    reqMeta?: { ipAddress?: string; userAgent?: string }
  ): Promise<{ success: boolean; message: string; workspaceId: string }> {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Acquire pessimistic row lock on Workspace and Transfer
      await tx.$executeRaw`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE;`;

      const ws = await tx.workspace.findUnique({
        where: { id: workspaceId },
      });

      if (!ws) throw new AppError('Workspace not found', 404);
      if (ws.deletedAt) throw new AppError('Cannot accept ownership of a deleted workspace', 400);

      const pending = await tx.workspaceOwnershipTransfer.findFirst({
        where: { workspaceId, status: 'PENDING' },
      });

      if (!pending) {
        throw new AppError('No pending ownership transfer found for this workspace', 404);
      }

      await tx.$executeRaw`SELECT id FROM "WorkspaceOwnershipTransfer" WHERE id = ${pending.id} FOR UPDATE;`;

      // 2. Re-validate transfer validity inside lock
      if (pending.status !== 'PENDING') {
        throw new AppError('Transfer is no longer pending and cannot be accepted', 409, undefined, 'CONFLICT');
      }

      if (pending.expiresAt <= new Date()) {
        await tx.workspaceOwnershipTransfer.update({
          where: { id: pending.id },
          data: { status: 'EXPIRED' },
        });
        throw new AppError('The ownership transfer request has expired', 400);
      }

      // 3. Re-validate recipient identity
      let isAuthorized = pending.targetUserId === recipientUserId;
      if (token) {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        if (tokenHash === pending.tokenHash) isAuthorized = true;
      }

      if (!isAuthorized) {
        throw new AppError('You are not the designated recipient of this ownership transfer', 403);
      }

      // Re-validate that recipient account is verified
      const recipient = await tx.user.findUnique({
        where: { id: pending.targetUserId },
        select: { id: true, isEmailVerified: true },
      });

      if (!recipient || !recipient.isEmailVerified) {
        throw new AppError('Recipient email must be verified to accept workspace ownership', 400);
      }

      // 4. Atomically transition transfer status
      const updatedTransferCount = await tx.workspaceOwnershipTransfer.updateMany({
        where: { id: pending.id, status: 'PENDING' },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      });

      if (updatedTransferCount.count === 0) {
        throw new AppError('Concurrent transfer update detected', 409, undefined, 'CONFLICT');
      }

      // 5. Update Workspace owner
      await tx.workspace.update({
        where: { id: workspaceId },
        data: { ownerId: pending.targetUserId },
      });

      // 6. Update Recipient membership to OWNER
      const recipientMember = await tx.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: pending.targetUserId,
          },
        },
      });

      if (recipientMember) {
        await tx.workspaceMember.update({
          where: { id: recipientMember.id },
          data: { role: 'OWNER' },
        });
      } else {
        await tx.workspaceMember.create({
          data: {
            workspaceId,
            userId: pending.targetUserId,
            role: 'OWNER',
            origin: 'DIRECT',
          },
        });
      }

      // 7. Update Former Owner membership to chosen targetRole (WORKSPACE_ADMIN or WORKSPACE_MEMBER)
      const formerOwnerMember = await tx.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: pending.sourceOwnerId,
          },
        },
      });

      if (formerOwnerMember) {
        await tx.workspaceMember.update({
          where: { id: formerOwnerMember.id },
          data: { role: pending.targetRole },
        });
      }

      // 8. Log sensitive audit event
      await workspaceAuditService.logAuditEvent(tx, {
        workspaceId,
        actorId: pending.targetUserId,
        action: 'OWNERSHIP_TRANSFERRED',
        targetType: 'USER',
        targetId: pending.targetUserId,
        metadata: {
          transferId: pending.id,
          previousOwnerId: pending.sourceOwnerId,
          newOwnerId: pending.targetUserId,
          formerOwnerRole: pending.targetRole,
        },
        ipAddress: reqMeta?.ipAddress,
        userAgent: reqMeta?.userAgent,
      });

      return {
        success: true,
        message: 'Workspace ownership transferred successfully',
        workspaceId,
        sourceOwnerId: pending.sourceOwnerId,
        targetUserId: pending.targetUserId,
        targetRole: pending.targetRole,
      };
    }, { timeout: 30000 });

    // Safe post-commit cache invalidation
    try {
      await Promise.allSettled([
        cacheService.delPattern(`*ws:${workspaceId}:*`),
        cacheService.invalidateUser(result.sourceOwnerId, workspaceId),
        cacheService.invalidateUser(result.targetUserId, workspaceId),
        cacheService.del(`user:${result.sourceOwnerId}:workspaces`),
        cacheService.del(`user:${result.targetUserId}:workspaces`),
      ]);
    } catch (cacheErr) {
      console.warn(`[Workspace Ownership] Cache invalidation warning for workspace ${workspaceId}:`, cacheErr);
    }

    // Refresh realtime authorization & notify affected users
    try {
      realtimeService.publishToUser(result.sourceOwnerId, 'WORKSPACE_ROLE_UPDATED' as any, {
        workspaceId,
        role: result.targetRole,
      });
      realtimeService.publishToUser(result.targetUserId, 'WORKSPACE_ROLE_UPDATED' as any, {
        workspaceId,
        role: 'OWNER',
      });
    } catch (rtErr) {
      console.warn(`[Workspace Ownership] Realtime notification warning for workspace ${workspaceId}:`, rtErr);
    }

    return {
      success: result.success,
      message: result.message,
      workspaceId: result.workspaceId,
    };
  }
}

export const workspaceOwnershipTransferService = new WorkspaceOwnershipTransferService();
