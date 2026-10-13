import prisma from '../prisma.js';
import { AppError } from '../middlewares/error.middleware.js';
import { resolveAdminPermissions } from '../schemas/workspace.schema.js';
import { notificationService } from './notification.service.js';
import { publishToProject, publishToUser, evictUserFromProjectRoom } from '../realtime/realtime.service.js';
import { cacheService } from '../redis/cache.service.js';
import type { ProjectTransferStatus } from '../generated/prisma/index.js';
import type { RequestProjectTransferInput, RejectProjectTransferInput } from '../schemas/projectTransfer.schema.js';

export interface ProjectTransferSummaryDto {
  id: string;
  projectId: string;
  projectName: string;
  projectKey: string | null;
  sourceWorkspaceId: string;
  sourceWorkspaceName: string;
  destinationWorkspaceId: string;
  destinationWorkspaceName: string;
  initiatedById: string;
  initiatedByName: string;
  reviewedById?: string | null;
  reviewedByName?: string | null;
  status: ProjectTransferStatus;
  rejectionReason?: string | null;
  memberSnapshot?: any;
  expiresAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ProjectTransferService {
  /**
   * Helper to verify if an actor has transfer authority in a given workspace.
   * Workspace Owner or Workspace Admin only. Project Admin alone cannot transfer.
   */
  private async verifyWorkspaceTransferAuthority(
    workspaceId: string,
    actorId: string,
    requiredPermission?: 'canCreateProjects'
  ) {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: { where: { userId: actorId } },
      },
    });

    if (!ws) {
      throw new AppError('Workspace not found', 404);
    }

    if (ws.deletedAt) {
      throw new AppError('Cannot transfer projects in a deleted workspace', 400);
    }

    const isOwner = ws.ownerId === actorId;
    const membership = ws.members[0];

    if (!isOwner && membership?.role !== 'WORKSPACE_ADMIN') {
      throw new AppError(
        'Workspace owner or administrator privileges in the workspace required to initiate or authorize project transfers',
        403
      );
    }

    if (!isOwner && membership?.role === 'WORKSPACE_ADMIN' && requiredPermission) {
      const permissions = resolveAdminPermissions(ws);
      if (!permissions[requiredPermission]) {
        throw new AppError(
          `Workspace administrator does not have permission to approve incoming project transfers into this workspace (${requiredPermission} permission is disabled)`,
          403
        );
      }
    }

    return { workspace: ws, isOwner, role: isOwner ? 'OWNER' : membership.role };
  }

  /**
   * Get transfer eligibility and candidate destination workspaces for a project.
   */
  async getTransferEligibility(projectId: string, actorId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        workspace: {
          select: { id: true, name: true, ownerId: true, isPersonal: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, fullName: true, username: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    // Verify actor authority in source workspace
    await this.verifyWorkspaceTransferAuthority(project.workspaceId, actorId);

    // Fetch candidate destination workspaces where actor has administrative authority (Owner or Admin)
    const memberships = await prisma.workspaceMember.findMany({
      where: {
        userId: actorId,
        role: { in: ['OWNER', 'WORKSPACE_ADMIN'] },
        workspace: {
          isPersonal: false, // Cannot transfer to personal workspaces
          id: { not: project.workspaceId }, // Cannot transfer to current workspace
          deletedAt: null, // Cannot transfer to deleted workspaces
        },
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            ownerId: true,
            isPersonal: true,
            adminPermissions: true,
            owner: {
              select: { id: true, fullName: true, username: true },
            },
          },
        },
      },
    });

    // Also check workspaces owned by user directly
    const ownedWorkspaces = await prisma.workspace.findMany({
      where: {
        ownerId: actorId,
        isPersonal: false,
        id: { not: project.workspaceId },
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        ownerId: true,
        isPersonal: true,
        owner: {
          select: { id: true, fullName: true, username: true },
        },
      },
    });

    const candidateMap = new Map<string, any>();
    for (const ws of ownedWorkspaces) {
      candidateMap.set(ws.id, {
        ...ws,
        isSameOwner: ws.ownerId === project.workspace.ownerId,
        actorRole: 'OWNER',
      });
    }
    for (const m of memberships) {
      if (!candidateMap.has(m.workspace.id)) {
        if (m.role === 'WORKSPACE_ADMIN') {
          const perms = resolveAdminPermissions(m.workspace);
          if (!perms.canCreateProjects) continue;
        }
        candidateMap.set(m.workspace.id, {
          ...m.workspace,
          isSameOwner: m.workspace.ownerId === project.workspace.ownerId,
          actorRole: m.role,
        });
      }
    }

    // Check for any currently active PENDING transfer
    const activeTransfer = await prisma.projectTransfer.findFirst({
      where: {
        projectId,
        status: 'PENDING',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        destinationWorkspace: { select: { id: true, name: true } },
        sourceWorkspace: { select: { id: true, name: true } },
        initiatedBy: { select: { id: true, fullName: true, username: true } },
      },
    });

    const candidateList = Array.from(candidateMap.values());

    return {
      isEligible: true,
      project: {
        id: project.id,
        name: project.name,
        key: project.key,
        workspaceId: project.workspace.id,
        currentWorkspaceId: project.workspace.id,
        currentWorkspaceName: project.workspace.name,
        isSourceOwner: project.workspace.ownerId === actorId,
      },
      sourceWorkspace: {
        id: project.workspace.id,
        name: project.workspace.name,
        isPersonal: project.workspace.isPersonal,
        isOwner: project.workspace.ownerId === actorId,
      },
      eligibleDestinations: candidateList,
      candidateWorkspaces: candidateList,
      currentMembers: project.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        user: m.user,
      })),
      activeTransfer: activeTransfer
        ? {
            id: activeTransfer.id,
            status: activeTransfer.status,
            destinationWorkspaceId: activeTransfer.destinationWorkspaceId,
            destinationWorkspaceName: activeTransfer.destinationWorkspace.name,
            sourceWorkspaceId: activeTransfer.sourceWorkspaceId,
            sourceWorkspaceName: activeTransfer.sourceWorkspace.name,
            initiatedById: activeTransfer.initiatedById,
            initiatedByName:
              activeTransfer.initiatedBy.fullName || activeTransfer.initiatedBy.username,
            expiresAt: activeTransfer.expiresAt,
            createdAt: activeTransfer.createdAt,
          }
        : null,
    };
  }

  /**
   * Request a project transfer to another workspace.
   * If same-owner, executes immediately.
   * If cross-owner, creates a PENDING request requiring destination approval.
   */
  async requestTransfer(projectId: string, actorId: string, input: RequestProjectTransferInput) {
    const { destinationWorkspaceId } = input;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        workspace: true,
        members: { include: { user: true } },
      },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    // 1. Verify source authority
    await this.verifyWorkspaceTransferAuthority(project.workspaceId, actorId);

    // 2. Validate destination workspace
    if (destinationWorkspaceId === project.workspaceId) {
      throw new AppError('Project already belongs to the target workspace', 400);
    }

    const destWs = await prisma.workspace.findUnique({
      where: { id: destinationWorkspaceId },
      include: {
        owner: { select: { id: true, fullName: true, username: true } },
        members: { where: { userId: actorId } },
      },
    });

    if (!destWs) {
      throw new AppError('Destination workspace not found', 404);
    }

    if (destWs.deletedAt) {
      throw new AppError('Destination workspace is scheduled for deletion and cannot receive projects', 400);
    }

    if (destWs.isPersonal) {
      throw new AppError('Projects cannot be transferred into personal workspaces', 400);
    }

    // 3. Concurrency check: No existing active PENDING transfer
    const existingPending = await prisma.projectTransfer.findFirst({
      where: {
        projectId,
        status: 'PENDING',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (existingPending) {
      throw new AppError('A pending transfer request already exists for this project', 409);
    }

    const isSameOwner = project.workspace.ownerId === destWs.ownerId;
    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { fullName: true, username: true },
    });
    const actorName = actor?.fullName || actor?.username || 'An administrator';

    // =========================================================================
    // CASE A: Same-Owner Transfer -> Execute Immediately
    // =========================================================================
    if (isSameOwner) {
      // Actor must have administrative authority in destination as well
      const isDestOwner = destWs.ownerId === actorId;
      const isDestAdmin = destWs.members[0]?.role === 'WORKSPACE_ADMIN';

      if (!isDestOwner && !isDestAdmin) {
        throw new AppError(
          'You must have administrator privileges in the destination workspace to perform a same-owner transfer',
          403
        );
      }

      // If actor is Admin in destination, Owner must have enabled canCreateProjects in destination
      if (!isDestOwner && isDestAdmin) {
        const destPerms = resolveAdminPermissions(destWs);
        if (!destPerms.canCreateProjects) {
          throw new AppError(
            'Workspace administrator does not have permission to transfer projects into destination workspace (canCreateProjects permission is disabled)',
            403
          );
        }
      }

      const { transfer, usersToEvict } = await prisma.$transaction(async (tx) => {
        // Concurrency row lock on Project
        await tx.$executeRawUnsafe('SELECT id FROM "Project" WHERE id = $1 FOR UPDATE;', projectId);

        // Recheck project still in source workspace
        const freshProject = await tx.project.findUnique({
          where: { id: projectId },
          select: { workspaceId: true },
        });

        if (!freshProject || freshProject.workspaceId !== project.workspaceId) {
          throw new AppError('Project is no longer in the source workspace or has already been transferred', 409);
        }

        // Revalidate destination workspace state inside transaction immediately before completing transfer
        const freshDestWs = await tx.workspace.findUnique({
          where: { id: destinationWorkspaceId },
          select: { id: true, isPersonal: true, deletedAt: true },
        });

        if (!freshDestWs) {
          throw new AppError('Destination workspace not found', 404);
        }

        if (freshDestWs.deletedAt) {
          throw new AppError('Destination workspace is scheduled for deletion and cannot receive projects', 400);
        }

        if (freshDestWs.isPersonal) {
          throw new AppError('Projects cannot be transferred into personal workspaces', 400);
        }

        // Create completed transfer record
        const t = await tx.projectTransfer.create({
          data: {
            projectId,
            sourceWorkspaceId: project.workspaceId,
            destinationWorkspaceId,
            initiatedById: actorId,
            reviewedById: actorId,
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });

        const result = await this.executeProjectTransferInternal(
          tx,
          project.id,
          project.workspaceId,
          destinationWorkspaceId,
          t.id,
          actorId
        );

        // Update transfer with member snapshot
        await tx.projectTransfer.update({
          where: { id: t.id },
          data: { memberSnapshot: result.memberSnapshot },
        });

        return { transfer: t, usersToEvict: result.usersToEvict };
      });

      // Post-commit cleanup
      await this.postTransferCleanup(projectId, project.workspaceId, destinationWorkspaceId, usersToEvict);

      return {
        success: true,
        executedImmediately: true,
        message: `Project "${project.name}" transferred to "${destWs.name}" successfully`,
        transfer,
      };
    }

    // =========================================================================
    // CASE B: Cross-Owner Transfer -> Create PENDING Request
    // =========================================================================
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    let pendingTransfer: any;
    try {
      pendingTransfer = await prisma.projectTransfer.create({
        data: {
          projectId,
          sourceWorkspaceId: project.workspaceId,
          destinationWorkspaceId,
          initiatedById: actorId,
          status: 'PENDING',
          expiresAt,
        },
        include: {
          project: { select: { id: true, name: true, key: true } },
          sourceWorkspace: { select: { id: true, name: true } },
          destinationWorkspace: { select: { id: true, name: true } },
          initiatedBy: { select: { id: true, fullName: true, username: true } },
        },
      });
    } catch (err: any) {
      if (
        err.code === 'P2002' ||
        err.message?.includes('ProjectTransfer_unique_pending_project_idx') ||
        err.message?.includes('Unique constraint failed')
      ) {
        throw new AppError('A pending transfer request already exists for this project', 409);
      }
      throw err;
    }

    // Notify destination workspace owner
    await notificationService.createNotification({
      recipientId: destWs.ownerId,
      actorId,
      projectId: project.id,
      type: 'SYSTEM',
      title: 'Project Transfer Request',
      message: `${actorName} requested to transfer project "${project.name}" into workspace "${destWs.name}".`,
      link: '/app/workspaces',
    });

    publishToUser(destWs.ownerId, 'PROJECT_TRANSFER_REQUESTED', {
      transferId: pendingTransfer.id,
      projectId: project.id,
      projectName: project.name,
      sourceWorkspaceId: project.workspaceId,
      destinationWorkspaceId,
      actorId,
      actorName,
    });

    return {
      success: true,
      executedImmediately: false,
      message: `Transfer request created and pending approval by "${destWs.name}" workspace administrators`,
      transfer: pendingTransfer,
    };
  }

  /**
   * Approve a cross-owner transfer request (Destination Owner or Admin only).
   */
  async approveTransfer(transferId: string, actorId: string) {
    const transfer = await prisma.projectTransfer.findUnique({
      where: { id: transferId },
      include: {
        project: true,
        sourceWorkspace: true,
        destinationWorkspace: true,
        initiatedBy: { select: { id: true, fullName: true, username: true } },
      },
    });

    if (!transfer) {
      throw new AppError('Transfer request not found', 404);
    }

    if (transfer.status !== 'PENDING') {
      throw new AppError(`Transfer request is not in PENDING status (current status: ${transfer.status})`, 409);
    }

    if (transfer.expiresAt && new Date(transfer.expiresAt) < new Date()) {
      await prisma.projectTransfer.update({
        where: { id: transferId },
        data: { status: 'EXPIRED' },
      });
      throw new AppError('This transfer request has expired', 409);
    }

    if (transfer.destinationWorkspace.deletedAt) {
      throw new AppError('Destination workspace is scheduled for deletion and cannot receive projects', 400);
    }

    // Validate destination authority and require canCreateProjects permission
    await this.verifyWorkspaceTransferAuthority(transfer.destinationWorkspaceId, actorId, 'canCreateProjects');

    // Prevent self-approval if cross-owner transfer
    const isSameOwner = transfer.sourceWorkspace.ownerId === transfer.destinationWorkspace.ownerId;
    if (!isSameOwner && transfer.initiatedById === actorId) {
      throw new AppError('Cross-owner transfers cannot be approved by the initiator in destination workspace', 403);
    }

    // Atomic execution inside transaction
    const { usersToEvict, updatedTransfer } = await prisma.$transaction(async (tx) => {
      // Row lock on Project and ProjectTransfer to serialize concurrent approvals
      await tx.$executeRawUnsafe('SELECT id FROM "Project" WHERE id = $1 FOR UPDATE;', transfer.projectId);
      await tx.$executeRawUnsafe('SELECT id FROM "ProjectTransfer" WHERE id = $1 FOR UPDATE;', transferId);

      // Re-verify transfer state inside transaction to prevent race conditions
      const fresh = await tx.projectTransfer.findUnique({
        where: { id: transferId },
        select: { status: true, expiresAt: true, projectId: true },
      });

      if (!fresh || fresh.status !== 'PENDING') {
        throw new AppError(
          `Transfer request is not in PENDING status (current status: ${fresh ? fresh.status : 'PROCESSED'})`,
          409
        );
      }

      if (fresh.expiresAt && new Date(fresh.expiresAt) < new Date()) {
        await tx.projectTransfer.update({
          where: { id: transferId },
          data: { status: 'EXPIRED' },
        });
        throw new AppError('This transfer request has expired', 400);
      }

      // Verify project is still in source workspace
      const currentProject = await tx.project.findUnique({
        where: { id: fresh.projectId },
        select: { workspaceId: true },
      });

      if (!currentProject || currentProject.workspaceId !== transfer.sourceWorkspaceId) {
        throw new AppError('Project is no longer in the source workspace', 409);
      }

      // Verify destination workspace still exists and is not personal or deleted
      const destWorkspace = await tx.workspace.findUnique({
        where: { id: transfer.destinationWorkspaceId },
        select: { id: true, isPersonal: true, ownerId: true, deletedAt: true },
      });
      if (!destWorkspace || destWorkspace.isPersonal) {
        throw new AppError('Destination workspace is invalid or no longer eligible for transfers', 400);
      }
      if (destWorkspace.deletedAt) {
        throw new AppError('Destination workspace is scheduled for deletion and cannot receive projects', 400);
      }

      const result = await this.executeProjectTransferInternal(
        tx,
        transfer.projectId,
        transfer.sourceWorkspaceId,
        transfer.destinationWorkspaceId,
        transfer.id,
        actorId
      );

      const updateResult = await tx.projectTransfer.updateMany({
        where: { id: transferId, status: 'PENDING' },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          reviewedById: actorId,
          memberSnapshot: result.memberSnapshot,
        },
      });

      if (updateResult.count === 0) {
        throw new AppError('Transfer request has already been processed', 409);
      }

      const t = await tx.projectTransfer.findUnique({
        where: { id: transferId },
      });

      return { usersToEvict: result.usersToEvict, updatedTransfer: t };
    });

    // Post-commit cleanup & room evictions
    await this.postTransferCleanup(
      transfer.projectId,
      transfer.sourceWorkspaceId,
      transfer.destinationWorkspaceId,
      usersToEvict
    );

    // Notify initiator of approval
    const reviewer = await prisma.user.findUnique({
      where: { id: actorId },
      select: { fullName: true, username: true },
    });
    const reviewerName = reviewer?.fullName || reviewer?.username || 'An administrator';

    await notificationService.createNotification({
      recipientId: transfer.initiatedById,
      actorId,
      projectId: transfer.projectId,
      type: 'SYSTEM',
      title: 'Project Transfer Approved',
      message: `${reviewerName} approved the transfer of "${transfer.project.name}" into "${transfer.destinationWorkspace.name}".`,
      link: `/app/projects/${transfer.projectId}`,
    });

    return {
      success: true,
      message: `Project "${transfer.project.name}" successfully transferred into "${transfer.destinationWorkspace.name}"`,
      transfer: updatedTransfer,
    };
  }

  /**
   * Reject a cross-owner transfer request (Destination Owner or Admin only).
   */
  async rejectTransfer(transferId: string, actorId: string, input: RejectProjectTransferInput) {
    const transfer = await prisma.projectTransfer.findUnique({
      where: { id: transferId },
      include: {
        project: { select: { name: true } },
        sourceWorkspace: true,
        destinationWorkspace: true,
      },
    });

    if (!transfer) {
      throw new AppError('Transfer request not found', 404);
    }

    if (transfer.status !== 'PENDING') {
      throw new AppError(`Transfer request is not in PENDING status (current status: ${transfer.status})`, 409);
    }

    // Validate destination authority
    await this.verifyWorkspaceTransferAuthority(transfer.destinationWorkspaceId, actorId);

    const updated = await prisma.projectTransfer.update({
      where: { id: transferId },
      data: {
        status: 'REJECTED',
        rejectionReason: input.reason ? input.reason.trim() : null,
        reviewedById: actorId,
        completedAt: new Date(),
      },
    });

    // Notify initiator
    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { fullName: true, username: true },
    });
    const actorName = actor?.fullName || actor?.username || 'An administrator';

    await notificationService.createNotification({
      recipientId: transfer.initiatedById,
      actorId,
      projectId: transfer.projectId,
      type: 'SYSTEM',
      title: 'Project Transfer Rejected',
      message: `${actorName} declined the transfer of project "${transfer.project.name}".${
        input.reason ? ` Reason: ${input.reason}` : ''
      }`,
      link: `/app/projects/${transfer.projectId}`,
    });

    publishToUser(transfer.initiatedById, 'PROJECT_TRANSFER_REJECTED', {
      transferId,
      projectId: transfer.projectId,
      projectName: transfer.project.name,
      reason: input.reason,
    });

    return {
      success: true,
      message: 'Transfer request rejected successfully',
      transfer: updated,
    };
  }

  /**
   * Cancel an eligible pending transfer request (Initiator or Source Owner/Admin only).
   */
  async cancelTransfer(transferId: string, actorId: string) {
    const transfer = await prisma.projectTransfer.findUnique({
      where: { id: transferId },
      include: { sourceWorkspace: true },
    });

    if (!transfer) {
      throw new AppError('Transfer request not found', 404);
    }

    if (transfer.status !== 'PENDING') {
      throw new AppError(`Transfer request is not in PENDING status (current status: ${transfer.status})`, 409);
    }

    const isInitiator = transfer.initiatedById === actorId;
    const isSourceOwner = transfer.sourceWorkspace.ownerId === actorId;

    if (!isInitiator && !isSourceOwner) {
      throw new AppError('Only the initiator or source workspace owner can cancel this transfer request', 403);
    }

    const updated = await prisma.projectTransfer.update({
      where: { id: transferId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Transfer request cancelled successfully',
      transfer: updated,
    };
  }

  /**
   * List pending transfer requests for a workspace (both incoming and outgoing).
   */
  async getWorkspacePendingTransfers(workspaceId: string, actorId: string) {
    await this.verifyWorkspaceTransferAuthority(workspaceId, actorId);

    const [incoming, outgoing] = await Promise.all([
      prisma.projectTransfer.findMany({
        where: {
          destinationWorkspaceId: workspaceId,
          status: 'PENDING',
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: {
          project: { select: { id: true, name: true, key: true } },
          sourceWorkspace: { select: { id: true, name: true } },
          destinationWorkspace: { select: { id: true, name: true } },
          initiatedBy: { select: { id: true, fullName: true, username: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.projectTransfer.findMany({
        where: {
          sourceWorkspaceId: workspaceId,
          status: 'PENDING',
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: {
          project: { select: { id: true, name: true, key: true } },
          sourceWorkspace: { select: { id: true, name: true } },
          destinationWorkspace: { select: { id: true, name: true } },
          initiatedBy: { select: { id: true, fullName: true, username: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { incoming, outgoing };
  }

  /**
   * List transfer history for a project.
   */
  async getProjectTransfers(projectId: string, actorId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });

    if (!project) throw new AppError('Project not found', 404);

    await this.verifyWorkspaceTransferAuthority(project.workspaceId, actorId);

    const transfers = await prisma.projectTransfer.findMany({
      where: { projectId },
      include: {
        sourceWorkspace: { select: { id: true, name: true } },
        destinationWorkspace: { select: { id: true, name: true } },
        initiatedBy: { select: { id: true, fullName: true, username: true } },
        reviewedBy: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return transfers;
  }

  /**
   * Get details of a single transfer request, verifying boundary access.
   */
  async getTransferDetails(transferId: string, actorId: string) {
    const transfer = await prisma.projectTransfer.findUnique({
      where: { id: transferId },
      include: {
        project: { select: { id: true, name: true, key: true, workspaceId: true } },
        sourceWorkspace: { select: { id: true, name: true, ownerId: true } },
        destinationWorkspace: { select: { id: true, name: true, ownerId: true } },
        initiatedBy: { select: { id: true, fullName: true, username: true, email: true, avatarUrl: true } },
        reviewedBy: { select: { id: true, fullName: true, username: true, email: true, avatarUrl: true } },
      },
    });

    if (!transfer) {
      throw new AppError('Transfer request not found', 404);
    }

    // Verify actor belongs to source or destination workspace
    const actorMembership = await prisma.workspaceMember.findFirst({
      where: {
        userId: actorId,
        workspaceId: { in: [transfer.sourceWorkspaceId, transfer.destinationWorkspaceId] },
      },
    });

    if (!actorMembership) {
      throw new AppError('You do not have access to view this transfer request', 403);
    }

    return transfer;
  }

  // =========================================================================
  // Internal Transactional Execution & Cleanup Helpers
  // =========================================================================

  /**
   * Executes atomic database mutations for project transfer inside an existing Prisma transaction.
   */
  private async executeProjectTransferInternal(
    tx: any,
    projectId: string,
    sourceWorkspaceId: string,
    destinationWorkspaceId: string,
    transferId: string,
    actorId: string
  ): Promise<{ usersToEvict: string[]; memberSnapshot: any }> {
    // 1. Move project to destination workspace conditionally
    const projectUpdate = await tx.project.updateMany({
      where: { id: projectId, workspaceId: sourceWorkspaceId },
      data: { workspaceId: destinationWorkspaceId },
    });

    if (projectUpdate.count === 0) {
      throw new AppError('Project is no longer in the expected source workspace or has already been transferred', 409);
    }

    // Cancel pending project invitations (Requirement 7)
    await tx.invitation.updateMany({
      where: { projectId, status: 'PENDING' },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    // 2. Fetch destination workspace members and owner
    const [destWs, destMembers] = await Promise.all([
      tx.workspace.findUnique({
        where: { id: destinationWorkspaceId },
        select: { ownerId: true, name: true, deletedAt: true },
      }),
      tx.workspaceMember.findMany({
        where: { workspaceId: destinationWorkspaceId },
        select: { userId: true },
      }),
    ]);

    if (!destWs) {
      throw new AppError('Destination workspace not found', 404);
    }

    if (destWs.deletedAt) {
      throw new AppError('Destination workspace is scheduled for deletion and cannot receive projects', 400);
    }

    const destUserIds = new Set<string>(destMembers.map((m: any) => m.userId));
    if (destWs?.ownerId) {
      destUserIds.add(destWs.ownerId);
    }

    // 3. Current project members
    const currentProjectMembers = await tx.projectMember.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, fullName: true, username: true, email: true } },
      },
    });

    // 4. Build historical member snapshot
    const memberSnapshot = currentProjectMembers.map((m: any) => ({
      userId: m.userId,
      role: m.role,
      inDestinationWorkspace: destUserIds.has(m.userId),
      retained: destUserIds.has(m.userId),
      user: m.user,
    }));

    // 5. Partition members: retained vs evicted
    const usersToEvict = currentProjectMembers
      .filter((m: any) => !destUserIds.has(m.userId))
      .map((m: any) => m.userId);

    // 6. Evict non-destination members
    if (usersToEvict.length > 0) {
      // Unassign active work items (preserves work item, comments, creator attribution)
      await tx.workItem.updateMany({
        where: {
          projectId,
          assignedToId: { in: usersToEvict },
        },
        data: { assignedToId: null },
      });

      // Remove ProjectMember records
      await tx.projectMember.deleteMany({
        where: {
          projectId,
          userId: { in: usersToEvict },
        },
      });
    }

    // 7. Update calendar feed tokens associated with this project
    await tx.calendarFeedToken.updateMany({
      where: { projectId },
      data: { workspaceId: destinationWorkspaceId },
    });

    // 8. Record project activity
    const sourceWs = await tx.workspace.findUnique({
      where: { id: sourceWorkspaceId },
      select: { name: true },
    });

    try {
      await tx.activity.create({
        data: {
          projectId,
          actorId,
          type: 'PROJECT_CREATED',
          metadata: {
            action: 'WORKSPACE_TRANSFERRED',
            sourceWorkspaceId,
            destinationWorkspaceId,
            sourceWorkspaceName: sourceWs?.name || 'Previous Workspace',
            destinationWorkspaceName: destWs?.name || 'New Workspace',
            retainedMemberCount: currentProjectMembers.length - usersToEvict.length,
            evictedMemberCount: usersToEvict.length,
          },
        },
      });
    } catch (actErr) {
      console.warn('[ProjectTransferService] Activity logging notice:', actErr);
    }

    return { usersToEvict, memberSnapshot };
  }

  /**
   * Post-commit cleanup: Room evictions, Cache invalidation, and Realtime events.
   */
  private async postTransferCleanup(
    projectId: string,
    sourceWorkspaceId: string,
    destinationWorkspaceId: string,
    usersToEvict: string[]
  ): Promise<void> {
    // 1. Evict evicted users from Socket.IO project room
    for (const userId of usersToEvict) {
      await evictUserFromProjectRoom(userId, projectId).catch(() => {});
    }

    // 2. Publish realtime project transfer event
    publishToProject(projectId, 'PROJECT_TRANSFERRED', {
      projectId,
      sourceWorkspaceId,
      destinationWorkspaceId,
    });

    // 3. Invalidate Redis / In-memory caches for both workspaces and project
    try {
      await Promise.all([
        cacheService.delPattern(`*ws:${sourceWorkspaceId}:*`),
        cacheService.delPattern(`*ws:${destinationWorkspaceId}:*`),
        cacheService.delPattern(`*project:${projectId}:*`),
      ]);
    } catch (cacheErr) {
      console.warn('[ProjectTransferService] Cache invalidation warning:', cacheErr);
    }
  }

  /**
   * Restores historical project roles for a user when they join a destination workspace.
   * Only restores if:
   * - Transfer was COMPLETED into this workspace
   * - Project is still in this workspace
   * - User was evicted during that transfer (in memberSnapshot with retained: false)
   * - No newer completed transfer exists for this project
   * - Not already restored and not currently a project member
   */
  async restoreEligibleProjectRolesForUser(tx: any, workspaceId: string, userId: string): Promise<string[]> {
    const completedTransfers = await tx.projectTransfer.findMany({
      where: {
        destinationWorkspaceId: workspaceId,
        status: 'COMPLETED',
      },
      orderBy: { completedAt: 'desc' },
    });

    const restoredProjectIds: string[] = [];
    const processedProjects = new Set<string>();

    for (const transfer of completedTransfers) {
      if (processedProjects.has(transfer.projectId)) continue;
      processedProjects.add(transfer.projectId);

      // 1. Verify project still belongs to this destination workspace
      const currentProject = await tx.project.findUnique({
        where: { id: transfer.projectId },
        select: { id: true, workspaceId: true },
      });

      if (!currentProject || currentProject.workspaceId !== workspaceId) {
        continue;
      }

      // 2. Check if user is already a member of the project
      const existingMember = await tx.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: transfer.projectId,
            userId,
          },
        },
      });

      if (existingMember) {
        continue;
      }

      // 3. Inspect memberSnapshot
      if (!Array.isArray(transfer.memberSnapshot)) {
        continue;
      }

      const snapshot = [...transfer.memberSnapshot];
      const memberEntryIndex = snapshot.findIndex(
        (m: any) => m && m.userId === userId && m.retained === false && !m.restoredAt
      );

      if (memberEntryIndex === -1) {
        continue;
      }

      const memberEntry = snapshot[memberEntryIndex];
      const role = memberEntry.role === 'PROJECT_ADMIN' ? 'PROJECT_ADMIN' : 'PROJECT_MEMBER';

      // 4. Restore project membership
      await tx.projectMember.create({
        data: {
          projectId: transfer.projectId,
          userId,
          role,
        },
      });

      // 5. Update snapshot to mark restored (prevents future stale restoration after explicit removal)
      snapshot[memberEntryIndex] = {
        ...memberEntry,
        restoredAt: new Date().toISOString(),
      };

      await tx.projectTransfer.update({
        where: { id: transfer.id },
        data: { memberSnapshot: snapshot },
      });

      restoredProjectIds.push(transfer.projectId);

      publishToProject(transfer.projectId, 'MEMBER_ADDED', {
        projectId: transfer.projectId,
        userId,
        role,
        restored: true,
      });
    }

    return restoredProjectIds;
  }
}

export const projectTransferService = new ProjectTransferService();
