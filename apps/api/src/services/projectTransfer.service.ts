import crypto from 'crypto';
import prisma from '../prisma.js';
import { AppError } from '../middlewares/error.middleware.js';
import { resolveAdminPermissions } from '../schemas/workspace.schema.js';
import { notificationService } from './notification.service.js';
import { publishToProject, publishToUser, evictUserFromProjectRoom } from '../realtime/realtime.service.js';
import { cacheService } from '../redis/cache.service.js';
import {
  sendProjectTransferRequestEmail,
  sendProjectTransferAcceptedEmail,
  sendProjectTransferRejectedEmail,
  sendProjectTransferMemberNoticeEmail,
} from './email.service.js';
import type { ProjectTransferStatus } from '../generated/prisma/index.js';
import type {
  RequestProjectTransferInput,
  ApproveProjectTransferInput,
  RejectProjectTransferInput,
} from '../schemas/projectTransfer.schema.js';

export interface ProjectTransferSummaryDto {
  id: string;
  projectId: string;
  projectName: string;
  projectKey: string | null;
  sourceWorkspaceId: string;
  sourceWorkspaceName: string;
  destinationWorkspaceId: string;
  destinationWorkspaceName: string;
  recipientEmail?: string | null;
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

    const isOwner = ws.ownerId === actorId;
    const membership = ws.members[0];

    if (!isOwner && membership?.role !== 'WORKSPACE_ADMIN') {
      throw new AppError(
        'Workspace owner or administrator privileges in the workspace required to initiate or authorize project transfers',
        403
      );
    }

    if (ws.deletedAt) {
      throw new AppError('Cannot transfer projects in a deleted workspace', 400);
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

    // Verify actor authority in source workspace (Workspace Owner or Workspace Admin)
    await this.verifyWorkspaceTransferAuthority(project.workspaceId, actorId);

    // Fetch candidate destination workspaces where actor has administrative authority (Owner or Admin)
    const memberships = await prisma.workspaceMember.findMany({
      where: {
        userId: actorId,
        role: { in: ['OWNER', 'WORKSPACE_ADMIN'] },
        workspace: {
          isPersonal: false,
          id: { not: project.workspaceId },
          deletedAt: null,
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
              select: { id: true, fullName: true, username: true, email: true },
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
          select: { id: true, fullName: true, username: true, email: true },
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
   * Cross-workspace requests send Brevo email & create in-app notification cards.
   */
  async requestTransfer(projectId: string, actorId: string, input: RequestProjectTransferInput) {
    let destinationWorkspaceId = input.destinationWorkspaceId;
    let targetRecipientEmail = input.destinationUserEmail?.trim().toLowerCase();
    let targetRecipientName = '';

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

    // 1. Verify source authority (Workspace Owner or Workspace Admin)
    await this.verifyWorkspaceTransferAuthority(project.workspaceId, actorId);

    // 2. Resolve destination workspace if recipient email + destination workspace name provided
    if (!destinationWorkspaceId && targetRecipientEmail && input.destinationWorkspaceName) {
      const targetUser = await prisma.user.findFirst({
        where: {
          email: { equals: targetRecipientEmail, mode: 'insensitive' },
        },
      });

      if (!targetUser) {
        throw new AppError(`No user found with email "${input.destinationUserEmail}"`, 404);
      }
      targetRecipientName = targetUser.fullName || targetUser.username;

      // Find matching destination workspace where targetUser is Owner or Workspace Admin
      const matchingWorkspaces = await prisma.workspace.findMany({
        where: {
          name: { equals: input.destinationWorkspaceName.trim(), mode: 'insensitive' },
          isPersonal: false,
          deletedAt: null,
          OR: [
            { ownerId: targetUser.id },
            { members: { some: { userId: targetUser.id, role: 'WORKSPACE_ADMIN' } } },
          ],
        },
        include: {
          owner: { select: { id: true, fullName: true, username: true, email: true } },
        },
      });

      if (matchingWorkspaces.length === 0) {
        throw new AppError(
          `Workspace "${input.destinationWorkspaceName}" not found or user "${input.destinationUserEmail}" is not an Owner or Workspace Administrator of that workspace`,
          404
        );
      }

      destinationWorkspaceId = matchingWorkspaces[0].id;
    }

    if (!destinationWorkspaceId) {
      throw new AppError('Destination workspace is required', 400);
    }

    // 3. Validate destination workspace
    if (destinationWorkspaceId === project.workspaceId) {
      throw new AppError('Project already belongs to this workspace', 400);
    }

    const destWs = await prisma.workspace.findUnique({
      where: { id: destinationWorkspaceId },
      include: {
        owner: { select: { id: true, fullName: true, username: true, email: true } },
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

    const isSameOwner = project.workspace.ownerId === destWs.ownerId;

    // =========================================================================
    // CASE A: Same-Owner Transfer (Immediate Atomic Execution)
    // Only if not explicitly targeting an external recipient email
    // =========================================================================
    if (isSameOwner && !input.destinationUserEmail) {
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

        const freshSourceWs = await tx.workspace.findUnique({
          where: { id: project.workspaceId },
          select: { id: true, deletedAt: true },
        });

        if (!freshSourceWs || freshSourceWs.deletedAt) {
          throw new AppError('Cannot transfer projects in a deleted workspace', 400);
        }

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

    if (!targetRecipientEmail) {
      targetRecipientEmail = destWs.owner.email;
      targetRecipientName = destWs.owner.fullName || destWs.owner.username;
    }

    // 4. Concurrency check: No existing active PENDING transfer
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

    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { fullName: true, username: true, email: true },
    });
    const actorName = actor?.fullName || actor?.username || 'An administrator';

    // 5. Create PENDING request requiring destination approval
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    let pendingTransfer: any;
    try {
      pendingTransfer = await prisma.projectTransfer.create({
        data: {
          projectId,
          sourceWorkspaceId: project.workspaceId,
          destinationWorkspaceId,
          recipientEmail: targetRecipientEmail,
          destinationWorkspaceName: destWs.name,
          initiatedById: actorId,
          status: 'PENDING',
          expiresAt,
        },
        include: {
          project: { select: { id: true, name: true, key: true } },
          sourceWorkspace: { select: { id: true, name: true } },
          destinationWorkspace: { select: { id: true, name: true } },
          initiatedBy: { select: { id: true, fullName: true, username: true, email: true } },
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

    // Send Brevo email notification to recipient
    if (targetRecipientEmail) {
      try {
        await sendProjectTransferRequestEmail({
          toEmail: targetRecipientEmail,
          recipientName: targetRecipientName || undefined,
          projectName: project.name,
          sourceWorkspaceName: project.workspace.name,
          destinationWorkspaceName: destWs.name,
          initiatorName: actorName,
          expiresAt,
        });
      } catch (mailErr) {
        console.error('[ProjectTransferService] Failed to send transfer request email:', mailErr);
      }
    }

    // In-app notifications to destination workspace owner
    await notificationService.createNotification({
      recipientId: destWs.ownerId,
      actorId,
      projectId: project.id,
      type: 'SYSTEM',
      title: 'Project Transfer Request',
      message: `${actorName} requested to transfer project "${project.name}" into workspace "${destWs.name}".`,
      link: '/app/invitations?tab=transfers',
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
   * Approve a transfer request (Destination Owner or Admin only).
   */
  async approveTransfer(
    transferId: string,
    actorId: string,
    options ?: ApproveProjectTransferInput
  ) {
      const transfer = await prisma.projectTransfer.findUnique({
        where: { id: transferId },
        include: {
          project: true,
          sourceWorkspace: true,
          destinationWorkspace: true,
          initiatedBy: { select: { id: true, fullName: true, username: true, email: true } },
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

      if (transfer.sourceWorkspace.deletedAt) {
        throw new AppError('Cannot transfer projects in a deleted workspace', 400);
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
        const { usersToEvict, newProjectId, memberSnapshot } = await prisma.$transaction(async (tx) => {
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

          // Verify source workspace still exists and is not deleted
          const sourceWorkspace = await tx.workspace.findUnique({
            where: { id: transfer.sourceWorkspaceId },
            select: { id: true, deletedAt: true },
          });
          if (!sourceWorkspace || sourceWorkspace.deletedAt) {
            throw new AppError('Cannot transfer projects in a deleted workspace', 400);
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
        actorId,
            options
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

          return {
            usersToEvict: result.usersToEvict,
            newProjectId: result.newProjectId,
            memberSnapshot: result.memberSnapshot,
          };
        });

        // Post-commit cleanup & room evictions
        await this.postTransferCleanup(
          newProjectId,
          transfer.sourceWorkspaceId,
          transfer.destinationWorkspaceId,
          usersToEvict
        );

        // Fetch approver and initiator user details
        const [initiatorUser, reviewer] = await Promise.all([
          prisma.user.findUnique({
            where: { id: transfer.initiatedById },
            select: { email: true, fullName: true, username: true },
          }),
          prisma.user.findUnique({
            where: { id: actorId },
            select: { email: true, fullName: true, username: true },
          }),
        ]);
        const reviewerName = reviewer?.fullName || reviewer?.username || 'An administrator';

        // Dispatch Brevo email notifications to BOTH parties
        if (initiatorUser?.email) {
          await sendProjectTransferAcceptedEmail({
            toEmail: initiatorUser.email,
            recipientName: initiatorUser.fullName || initiatorUser.username,
            projectName: transfer.project.name,
            sourceWorkspaceName: transfer.sourceWorkspace.name,
            destinationWorkspaceName: transfer.destinationWorkspace.name,
            acceptedByName: reviewerName,
            isInitiator: true,
          }).catch((e) => console.error('[ProjectTransferService] Email to initiator failed:', e));
        }

        if (reviewer?.email && reviewer.email !== initiatorUser?.email) {
          await sendProjectTransferAcceptedEmail({
            toEmail: reviewer.email,
            recipientName: reviewerName,
            projectName: transfer.project.name,
            sourceWorkspaceName: transfer.sourceWorkspace.name,
            destinationWorkspaceName: transfer.destinationWorkspace.name,
            acceptedByName: reviewerName,
            isInitiator: false,
          }).catch((e) => console.error('[ProjectTransferService] Email to approver failed:', e));
        }

        // In-app notification to initiator
        await notificationService.createNotification({
          recipientId: transfer.initiatedById,
          actorId,
          projectId: newProjectId,
          type: 'SYSTEM',
          title: 'Project Transfer Approved',
          message: `${reviewerName} approved the transfer of "${transfer.project.name}" into "${transfer.destinationWorkspace.name}".`,
          link: `/app/projects/${newProjectId}`,
        });

        const updatedTransfer = await prisma.projectTransfer.findUnique({
          where: { id: transferId },
          include: {
            project: { select: { id: true, name: true, key: true } },
            sourceWorkspace: { select: { id: true, name: true } },
            destinationWorkspace: { select: { id: true, name: true } },
            initiatedBy: { select: { id: true, fullName: true, username: true } },
            reviewedBy: { select: { id: true, fullName: true, username: true } },
          },
        });

        return {
          success: true,
          message: `Project "${transfer.project.name}" successfully transferred into "${transfer.destinationWorkspace.name}"`,
          transfer: updatedTransfer,
          newProjectId,
        };
      }

  /**
   * Reject a transfer request (Destination Owner or Admin only).
   */
  async rejectTransfer(transferId: string, actorId: string, input: RejectProjectTransferInput) {
        const transfer = await prisma.projectTransfer.findUnique({
          where: { id: transferId },
          include: {
            project: { select: { id: true, name: true } },
            sourceWorkspace: true,
            destinationWorkspace: true,
          },
        });

        if(!transfer) {
          throw new AppError('Transfer request not found', 404);
        }

    if(transfer.status !== 'PENDING') {
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

    // Notify initiator and send Brevo emails to both parties
    const [actor, initiator] = await Promise.all([
      prisma.user.findUnique({
        where: { id: actorId },
        select: { fullName: true, username: true, email: true },
      }),
      prisma.user.findUnique({
        where: { id: transfer.initiatedById },
        select: { fullName: true, username: true, email: true },
      }),
    ]);
    const actorName = actor?.fullName || actor?.username || 'An administrator';

    if (initiator?.email) {
      await sendProjectTransferRejectedEmail({
        toEmail: initiator.email,
        recipientName: initiator.fullName || initiator.username,
        projectName: transfer.project.name,
        sourceWorkspaceName: transfer.sourceWorkspace.name,
        destinationWorkspaceName: transfer.destinationWorkspace.name,
        rejectedByName: actorName,
        reason: input.reason || null,
        isInitiator: true,
      }).catch((e) => console.error('[ProjectTransferService] Email to initiator failed:', e));
    }

    if (actor?.email && actor.email !== initiator?.email) {
      await sendProjectTransferRejectedEmail({
        toEmail: actor.email,
        recipientName: actorName,
        projectName: transfer.project.name,
        sourceWorkspaceName: transfer.sourceWorkspace.name,
        destinationWorkspaceName: transfer.destinationWorkspace.name,
        rejectedByName: actorName,
        reason: input.reason || null,
        isInitiator: false,
      }).catch((e) => console.error('[ProjectTransferService] Email to rejecter failed:', e));
    }

    await notificationService.createNotification({
      recipientId: transfer.initiatedById,
      actorId,
      projectId: transfer.projectId,
      type: 'SYSTEM',
      title: 'Project Transfer Rejected',
      message: `${actorName} declined the transfer of project "${transfer.project.name}".${input.reason ? ` Reason: ${input.reason}` : ''
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
   * List user's pending transfers across all workspaces where they are owner or admin.
   */
  async getUserPendingTransfers(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) throw new AppError('User not found', 404);

    const adminMemberships = await prisma.workspaceMember.findMany({
      where: {
        userId,
        role: { in: ['OWNER', 'WORKSPACE_ADMIN'] },
        workspace: { deletedAt: null },
      },
      select: { workspaceId: true },
    });
    const ownedWorkspaces = await prisma.workspace.findMany({
      where: { ownerId: userId, deletedAt: null },
      select: { id: true },
    });

    const adminWsIds = Array.from(
      new Set([
        ...adminMemberships.map((m) => m.workspaceId),
        ...ownedWorkspaces.map((w) => w.id),
      ])
    );

    const [incoming, outgoing] = await Promise.all([
      prisma.projectTransfer.findMany({
        where: {
          status: 'PENDING',
          OR: [
            { destinationWorkspaceId: { in: adminWsIds } },
            { recipientEmail: { equals: user.email, mode: 'insensitive' } },
          ],
          AND: [
            { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          ],
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              key: true,
              description: true,
              members: {
                include: {
                  user: {
                    select: { id: true, fullName: true, username: true, email: true, avatarUrl: true },
                  },
                },
              },
            },
          },
          sourceWorkspace: { select: { id: true, name: true } },
          destinationWorkspace: {
            select: {
              id: true,
              name: true,
              members: {
                select: { userId: true, role: true },
              },
            },
          },
          initiatedBy: { select: { id: true, fullName: true, username: true, email: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.projectTransfer.findMany({
        where: {
          status: 'PENDING',
          OR: [
            { initiatedById: userId },
            { sourceWorkspaceId: { in: adminWsIds } },
          ],
          AND: [
            { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          ],
        },
        include: {
          project: { select: { id: true, name: true, key: true, description: true } },
          sourceWorkspace: { select: { id: true, name: true } },
          destinationWorkspace: { select: { id: true, name: true } },
          initiatedBy: { select: { id: true, fullName: true, username: true, email: true, avatarUrl: true } },
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
        project: {
          select: {
            id: true,
            name: true,
            key: true,
            workspaceId: true,
            members: {
              include: {
                user: { select: { id: true, fullName: true, username: true, email: true, avatarUrl: true } },
              },
            },
          },
        },
        sourceWorkspace: { select: { id: true, name: true, ownerId: true } },
        destinationWorkspace: {
          select: {
            id: true,
            name: true,
            ownerId: true,
            members: { select: { userId: true, role: true } },
          },
        },
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

  /**
   * Get deferred previous members for a transferred project (for Project Overview banner).
   */
  async getDeferredMembers(projectId: string, actorId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });
    if (!project) throw new AppError('Project not found', 404);

    await this.verifyWorkspaceTransferAuthority(project.workspaceId, actorId);

    const latestTransfer = await prisma.projectTransfer.findFirst({
      where: {
        projectId,
        status: 'COMPLETED',
      },
      orderBy: { completedAt: 'desc' },
    });

    if (!latestTransfer || !Array.isArray(latestTransfer.memberSnapshot)) {
      return { hasDeferredMembers: false, deferredMembers: [], sourceWorkspaceName: null };
    }

    const snapshot = Array.isArray(latestTransfer.memberSnapshot)
      ? (latestTransfer.memberSnapshot as any[])
      : [];
    const deferred = snapshot.filter(
      (m: any) => m && m.deferred === true && !m.retained && !m.dismissedAt
    );

    const sourceWs = await prisma.workspace.findUnique({
      where: { id: latestTransfer.sourceWorkspaceId },
      select: { name: true },
    });

    return {
      hasDeferredMembers: deferred.length > 0,
      deferredMembers: deferred,
      sourceWorkspaceName: sourceWs?.name || 'Previous Workspace',
      transferId: latestTransfer.id,
    };
  }

  /**
   * Resolve deferred previous members (Invite them to workspace or dismiss banner).
   */
  async resolveDeferredMembers(
    projectId: string,
    actorId: string,
    input: { action: 'INVITE' | 'DISMISS'; userIds?: string[] }
  ) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });
    if (!project) throw new AppError('Project not found', 404);

    await this.verifyWorkspaceTransferAuthority(project.workspaceId, actorId);

    const latestTransfer = await prisma.projectTransfer.findFirst({
      where: {
        projectId,
        status: 'COMPLETED',
      },
      orderBy: { completedAt: 'desc' },
    });

    if (!latestTransfer || !Array.isArray(latestTransfer.memberSnapshot)) {
      return { success: true };
    }

    const snapshot: any[] = Array.isArray(latestTransfer.memberSnapshot)
      ? (latestTransfer.memberSnapshot as any[])
      : [];
    const targetUserIds = input.userIds ? new Set(input.userIds) : null;

    for (let i = 0; i < snapshot.length; i++) {
      const entry: any = snapshot[i];
      if (entry && entry.deferred && !entry.dismissedAt) {
        if (!targetUserIds || targetUserIds.has(entry.userId)) {
          if (input.action === 'INVITE') {
            if (entry.user?.email) {
              const existingInv = await prisma.workspaceInvitation.findFirst({
                where: {
                  workspaceId: project.workspaceId,
                  invitedEmail: { equals: entry.user.email, mode: 'insensitive' },
                  status: 'PENDING',
                },
              });
              if (!existingInv) {
                const rawToken = crypto.randomBytes(32).toString('hex');
                const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 7);
                await prisma.workspaceInvitation.create({
                  data: {
                    workspaceId: project.workspaceId,
                    invitedEmail: entry.user.email.toLowerCase(),
                    role: 'WORKSPACE_MEMBER',
                    tokenHash,
                    expiresAt,
                    invitedById: actorId,
                    status: 'PENDING',
                  },
                });
              }
            }
            snapshot[i] = { ...entry, deferred: false, invitedAt: new Date().toISOString() };
          } else {
            snapshot[i] = { ...entry, deferred: false, dismissedAt: new Date().toISOString() };
          }
        }
      }
    }

    await prisma.projectTransfer.update({
      where: { id: latestTransfer.id },
      data: { memberSnapshot: snapshot },
    });

    return { success: true };
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
      actorId: string,
      options?: ApproveProjectTransferInput
  ): Promise<{ usersToEvict: string[]; newProjectId: string; memberSnapshot: any }>{
      // 1. Fetch current project to track originalProjectId and determine rotation
      const currentProject = await tx.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true, key: true, originalProjectId: true, workspaceId: true },
      });

      if (!currentProject || currentProject.workspaceId !== sourceWorkspaceId) {
        throw new AppError('Project is no longer in the expected source workspace or has already been transferred', 409);
      }

      const originalProjectId = currentProject.originalProjectId || currentProject.id;

      // Check if retransferring back to original workspace
      const firstTransfer = await tx.projectTransfer.findFirst({
        where: {
          OR: [
            { projectId },
            { projectId: originalProjectId },
          ],
          status: 'COMPLETED',
        },
        orderBy: { completedAt: 'asc' },
      });
      const originalWorkspaceId = firstTransfer ? firstTransfer.sourceWorkspaceId : currentProject.workspaceId;

      const shouldRotateId = Boolean(
        options?.memberAction || options?.newProjectKey || options?.sharedMemberDecisions
      );
      let targetProjectId = projectId;

      if (shouldRotateId) {
        if (currentProject.originalProjectId && destinationWorkspaceId === originalWorkspaceId) {
          // Retransferring back to original workspace: restore original project ID
          targetProjectId = currentProject.originalProjectId;
        } else {
          // Transferring to a new workspace: generate a new UUID
          targetProjectId = crypto.randomUUID();
        }

        // Update Project row directly via raw SQL to cascade foreign keys on update
        await tx.$executeRawUnsafe(
          'UPDATE "Project" SET "id" = $1, "workspaceId" = $2, "originalProjectId" = $3 WHERE "id" = $4;',
          targetProjectId,
          destinationWorkspaceId,
          originalProjectId,
          projectId
        );
      } else {
        await tx.project.update({
          where: { id: projectId },
          data: {
            workspaceId: destinationWorkspaceId,
            originalProjectId,
          },
        });
      }

      // Apply new project key if requested or resolve collision
      if (options?.newProjectKey) {
        await tx.project.update({
          where: { id: targetProjectId },
          data: { key: options.newProjectKey.trim().toUpperCase() },
        });
      } else if (currentProject.key) {
        const collision = await tx.project.findFirst({
          where: {
            workspaceId: destinationWorkspaceId,
            key: currentProject.key,
            id: { not: targetProjectId },
          },
        });
        if (collision) {
          const suffix = Math.floor(10 + Math.random() * 90);
          const safeKey = `${currentProject.key.slice(0, 8)}${suffix}`.toUpperCase();
          await tx.project.update({
            where: { id: targetProjectId },
            data: { key: safeKey },
          });
        }
      }

      // Cancel pending project invitations
      await tx.invitation.updateMany({
        where: { projectId: targetProjectId, status: 'PENDING' },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });

      // 2. Fetch destination workspace members and owner
      const [sourceWs, destWs, destMembers] = await Promise.all([
        tx.workspace.findUnique({
          where: { id: sourceWorkspaceId },
          select: { id: true, name: true, deletedAt: true },
        }),
        tx.workspace.findUnique({
          where: { id: destinationWorkspaceId },
          select: { ownerId: true, name: true, deletedAt: true },
        }),
        tx.workspaceMember.findMany({
          where: { workspaceId: destinationWorkspaceId },
          select: { userId: true, role: true },
        }),
      ]);

      if (!sourceWs || sourceWs.deletedAt) {
        throw new AppError('Cannot transfer projects in a deleted workspace', 400);
      }

      if (!destWs) {
        throw new AppError('Destination workspace not found', 404);
      }

      if (destWs.deletedAt) {
        throw new AppError('Destination workspace is scheduled for deletion and cannot receive projects', 400);
      }

      const destMemberRoleMap = new Map<string, string>();
      for (const dm of destMembers) {
        destMemberRoleMap.set(dm.userId, dm.role);
      }
      if (destWs?.ownerId) {
        destMemberRoleMap.set(destWs.ownerId, 'OWNER');
      }

      // 3. Current project members
      const currentProjectMembers = await tx.projectMember.findMany({
        where: { projectId: targetProjectId },
        include: {
          user: { select: { id: true, fullName: true, username: true, email: true } },
        },
      });

      const sharedMembers = currentProjectMembers.filter((m: any) => destMemberRoleMap.has(m.userId));
      const previousMembers = currentProjectMembers.filter((m: any) => !destMemberRoleMap.has(m.userId));

      const usersToEvict: string[] = [];
      const snapshot: any[] = [];

          // Process Shared Members
          for(const sm of sharedMembers) {
            const decision = options?.sharedMemberDecisions?.[sm.userId];
            if (decision === 'REMOVE') {
              usersToEvict.push(sm.userId);
              snapshot.push({
                userId: sm.userId,
                role: sm.role,
                inDestinationWorkspace: true,
                retained: false,
                removalDecision: 'EXPLICIT_REMOVE',
                user: sm.user,
              });
            } else {
              snapshot.push({
                userId: sm.userId,
                role: sm.role,
                inDestinationWorkspace: true,
                retained: true,
                user: sm.user,
              });
            }
          }

    // Ensure destination workspace owner is a ProjectMember (as PROJECT_ADMIN)
    if(destWs?.ownerId) {
            const isOwnerMember = await tx.projectMember.findUnique({
              where: { projectId_userId: { projectId: targetProjectId, userId: destWs.ownerId } },
            });
            if (!isOwnerMember) {
              await tx.projectMember.create({
                data: {
                  projectId: targetProjectId,
                  userId: destWs.ownerId,
                  role: 'PROJECT_ADMIN',
                },
              });
            }
          }

    // Process Previous Members (Non-destination members)
    const memberAction = options?.memberAction;

    if (!memberAction) {
      // Legacy callers/tests: evict them, retain: false
      for (const pm of previousMembers) {
        usersToEvict.push(pm.userId);
        snapshot.push({
          userId: pm.userId,
          role: pm.role,
          inDestinationWorkspace: false,
          retained: false,
          user: pm.user,
        });
      }
    } else if (memberAction === 'INVITE_ALL') {
      for (const pm of previousMembers) {
        usersToEvict.push(pm.userId);
        snapshot.push({
          userId: pm.userId,
          role: pm.role,
          inDestinationWorkspace: false,
          retained: false,
          invitedToWorkspace: true,
          user: pm.user,
        });

        // Send workspace invitations
        if (pm.user?.email) {
          const existingInv = await tx.workspaceInvitation.findFirst({
            where: {
              workspaceId: destinationWorkspaceId,
              invitedEmail: { equals: pm.user.email, mode: 'insensitive' },
              status: 'PENDING',
            },
          });
          if (!existingInv) {
            const rawToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);
            await tx.workspaceInvitation.create({
              data: {
                workspaceId: destinationWorkspaceId,
                invitedEmail: pm.user.email.toLowerCase(),
                role: 'WORKSPACE_MEMBER',
                tokenHash,
                expiresAt,
                invitedById: actorId,
                status: 'PENDING',
              },
            });
          }
        }
      }
    } else if (memberAction === 'DECIDE_LATER') {
      for (const pm of previousMembers) {
        usersToEvict.push(pm.userId);
        snapshot.push({
          userId: pm.userId,
          role: pm.role,
          inDestinationWorkspace: false,
          retained: false,
          deferred: true,
          user: pm.user,
        });
      }
    } else if (memberAction === 'REMOVE_ALL') {
      for (const pm of previousMembers) {
        usersToEvict.push(pm.userId);
        snapshot.push({
          userId: pm.userId,
          role: pm.role,
          inDestinationWorkspace: false,
          retained: false,
          removalDecision: 'REMOVED_BY_NEW_OWNER',
          user: pm.user,
        });
      }

      // Send removal notice emails
      for (const pm of previousMembers) {
        if (pm.user?.email) {
          await sendProjectTransferMemberNoticeEmail({
            toEmail: pm.user.email,
            memberName: pm.user.fullName || pm.user.username,
            projectName: currentProject.name,
            sourceWorkspaceName: sourceWs?.name || 'Previous Workspace',
            destinationWorkspaceName: destWs?.name || 'New Workspace',
          }).catch(() => { });
        }
      }
    }

        // Evict users who are not retained from ProjectMember
        // NOTE: In the new transfer workflow, we deliberately PRESERVE workItem.assignedToId so assigned tasks
        // retain the user name and avatar with the "[Previous Member]" tag in the UI.
        // For backwards compatibility with legacy API callers/tests without member decisions, unassign them.
        if (usersToEvict.length > 0) {
          if (!shouldRotateId) {
            await tx.workItem.updateMany({
              where: {
                projectId: targetProjectId,
                assignedToId: { in: usersToEvict },
              },
              data: { assignedToId: null },
            });
          }
          await tx.projectMember.deleteMany({
            where: {
              projectId: targetProjectId,
              userId: { in: usersToEvict },
            },
          });
        }

        // 4. Update calendar feed tokens associated with this project
        await tx.calendarFeedToken.updateMany({
          where: { projectId: targetProjectId },
          data: { workspaceId: destinationWorkspaceId },
        });

        // 5. Record project activity
        try {
          await tx.activity.create({
            data: {
              projectId: targetProjectId,
              actorId,
              type: 'PROJECT_CREATED',
              metadata: {
                action: 'WORKSPACE_TRANSFERRED',
                sourceWorkspaceId,
                destinationWorkspaceId,
                sourceWorkspaceName: sourceWs?.name || 'Previous Workspace',
                destinationWorkspaceName: destWs?.name || 'New Workspace',
                memberAction,
                retainedMemberCount: currentProjectMembers.length - usersToEvict.length,
                evictedMemberCount: usersToEvict.length,
              },
            },
          });
        } catch (actErr) {
          console.warn('[ProjectTransferService] Activity logging notice:', actErr);
        }

        return { usersToEvict, newProjectId: targetProjectId, memberSnapshot: snapshot };
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
      await evictUserFromProjectRoom(userId, projectId).catch(() => { });
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

      // 5. Update snapshot to mark restored
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
