import crypto from 'node:crypto';
import prisma from '../prisma.js';
import { AppError } from '../middlewares/error.middleware.js';
import { resolveAdminPermissions, type CreateWorkspaceInvitationInput } from '../schemas/workspace.schema.js';
import { enqueueEmailJob } from '../jobs/queues.js';
import { notificationService } from './notification.service.js';
import { publishToUser } from '../realtime/realtime.service.js';
import type { WorkspaceRole } from '../generated/prisma/index.js';

export class WorkspaceInvitationService {
  /**
   * Helper to verify inviter's authority to send workspace invitations
   */
  private async verifyInviteAuthority(workspaceId: string, actorId: string) {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: { where: { userId: actorId } },
      },
    });

    if (!ws) {
      throw new AppError('Workspace not found', 404);
    }

    if (ws.isPersonal) {
      throw new AppError('Cannot invite members to a personal workspace', 400);
    }

    const isOwner = ws.ownerId === actorId;
    const membership = ws.members[0];

    if (!isOwner && !membership) {
      throw new AppError('You are not a member of this workspace', 403);
    }

    const role: WorkspaceRole = isOwner ? 'OWNER' : membership.role;

    if (role === 'WORKSPACE_MEMBER') {
      throw new AppError('Workspace members cannot invite other members', 403);
    }

    if (role === 'WORKSPACE_ADMIN') {
      const permissions = resolveAdminPermissions(ws);
      if (!permissions.canInviteMembers) {
        throw new AppError('Workspace administrator does not have permission to invite members', 403);
      }
    }

    return { workspace: ws, isOwner, role };
  }

  /**
   * Create an email invitation to a workspace
   */
  async createInvitation(workspaceId: string, actorId: string, input: CreateWorkspaceInvitationInput) {
    const { workspace } = await this.verifyInviteAuthority(workspaceId, actorId);

    const normalizedEmail = input.email.toLowerCase().trim();

    // 1. Fetch actor details
    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { fullName: true, username: true, email: true },
    });

    if (actor && actor.email.toLowerCase() === normalizedEmail) {
      throw new AppError('You cannot invite yourself to the workspace', 400);
    }

    // Role cannot be OWNER
    if ((input.role as any) === 'OWNER') {
      throw new AppError('Workspace invitations cannot assign Owner role', 400);
    }

    // 2. Check if a user with this email is ALREADY an active workspace member or owner
    const targetUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (targetUser && workspace.ownerId === targetUser.id) {
      throw new AppError('This user is already the owner of this workspace', 400);
    }

    const existingMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        user: { email: normalizedEmail },
      },
    });

    if (existingMember) {
      throw new AppError('This user is already a member of this workspace', 400);
    }

    // 3. Check for existing active PENDING invitation
    const existingPending = await prisma.workspaceInvitation.findFirst({
      where: {
        workspaceId,
        invitedEmail: normalizedEmail,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });

    if (existingPending) {
      throw new AppError('A pending invitation has already been sent to this email address', 409);
    }

    // 4. Generate high-entropy token and hash (32 bytes)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // 7-day expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        invitedEmail: normalizedEmail,
        invitedUserId: targetUser?.id || null,
        invitedById: actorId,
        role: input.role || 'WORKSPACE_MEMBER',
        message: input.message ? input.message.trim() : null,
        status: 'PENDING',
        tokenHash,
        expiresAt,
      },
      include: {
        invitedBy: {
          select: { id: true, fullName: true, username: true },
        },
      },
    });

    // 5. Dispatch email via BullMQ / fallback
    const inviterName = actor?.fullName || actor?.username || 'A team member';
    await enqueueEmailJob({
      type: 'WORKSPACE_INVITATION',
      toEmail: normalizedEmail,
      inviterName,
      workspaceName: workspace.name,
      role: invitation.role,
      token: rawToken,
      message: invitation.message,
      expiresAt: expiresAt.toISOString(),
    });

    // 6. In-app notification if target user is registered
    if (targetUser && targetUser.id !== actorId) {
      await notificationService.createNotification({
        recipientId: targetUser.id,
        actorId,
        type: 'SYSTEM',
        title: 'Workspace Invitation',
        message: `${inviterName} invited you to join the "${workspace.name}" workspace.`,
        link: '/app/invitations',
      });

      publishToUser(targetUser.id, 'WORKSPACE_INVITATION_RECEIVED', {
        workspaceId,
        invitationId: invitation.id,
        actorId,
        actorName: inviterName,
      });
    }

    // Return invitation details without exposing internal tokenHash
    return {
      id: invitation.id,
      workspaceId: invitation.workspaceId,
      invitedEmail: invitation.invitedEmail,
      invitedUserId: invitation.invitedUserId,
      role: invitation.role,
      status: invitation.status,
      message: invitation.message,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      invitedBy: invitation.invitedBy,
      token: rawToken, // Provided once to inviter for direct sharing if needed
    };
  }

  /**
   * List all invitations for a workspace (Admin/Owner only)
   */
  async getWorkspaceInvitations(workspaceId: string, actorId: string) {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: { where: { userId: actorId } },
      },
    });

    if (!ws) throw new AppError('Workspace not found', 404);

    const isOwner = ws.ownerId === actorId;
    const membership = ws.members[0];

    if (!isOwner && membership?.role !== 'WORKSPACE_ADMIN') {
      throw new AppError('Workspace administrator privileges required to view invitations', 403);
    }

    const invitations = await prisma.workspaceInvitation.findMany({
      where: { workspaceId },
      include: {
        invitedBy: {
          select: { id: true, fullName: true, username: true },
        },
        invitedUser: {
          select: { id: true, fullName: true, username: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    return invitations.map((inv) => {
      let currentStatus = inv.status;
      if (inv.status === 'PENDING' && new Date(inv.expiresAt) < now) {
        currentStatus = 'EXPIRED';
      }
      return {
        id: inv.id,
        workspaceId: inv.workspaceId,
        invitedEmail: inv.invitedEmail,
        invitedUserId: inv.invitedUserId,
        role: inv.role,
        status: currentStatus,
        message: inv.message,
        expiresAt: inv.expiresAt,
        acceptedAt: inv.acceptedAt,
        declinedAt: inv.declinedAt,
        revokedAt: inv.revokedAt,
        createdAt: inv.createdAt,
        isExpired: new Date(inv.expiresAt) < now,
        invitedBy: inv.invitedBy,
        invitedUser: inv.invitedUser,
      };
    });
  }

  /**
   * Resend a pending or expired invitation (Owner or Admin with canInviteMembers)
   */
  async resendInvitation(workspaceId: string, invitationId: string, actorId: string) {
    const { workspace } = await this.verifyInviteAuthority(workspaceId, actorId);

    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { id: invitationId },
      include: {
        invitedBy: { select: { fullName: true, username: true } },
      },
    });

    if (!invitation || invitation.workspaceId !== workspaceId) {
      throw new AppError('Invitation not found', 404);
    }

    if (invitation.status === 'ACCEPTED') {
      throw new AppError('Cannot resend an already accepted invitation', 400);
    }

    if (invitation.status === 'REVOKED') {
      throw new AppError('Cannot resend a revoked invitation. Please send a new invitation.', 400);
    }

    // Refresh token and 7-day expiration
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const updated = await prisma.workspaceInvitation.update({
      where: { id: invitationId },
      data: {
        tokenHash,
        status: 'PENDING',
        expiresAt,
        updatedAt: new Date(),
      },
      include: {
        invitedBy: { select: { id: true, fullName: true, username: true } },
      },
    });

    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { fullName: true, username: true },
    });
    const inviterName = actor?.fullName || actor?.username || 'A team member';

    await enqueueEmailJob({
      type: 'WORKSPACE_INVITATION',
      toEmail: updated.invitedEmail,
      inviterName,
      workspaceName: workspace.name,
      role: updated.role,
      token: rawToken,
      message: updated.message,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      id: updated.id,
      workspaceId: updated.workspaceId,
      invitedEmail: updated.invitedEmail,
      role: updated.role,
      status: updated.status,
      expiresAt: updated.expiresAt,
      token: rawToken,
    };
  }

  /**
   * Revoke a pending invitation
   */
  async revokeInvitation(workspaceId: string, invitationId: string, actorId: string) {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: { where: { userId: actorId } },
      },
    });

    if (!ws) throw new AppError('Workspace not found', 404);

    const isOwner = ws.ownerId === actorId;
    const membership = ws.members[0];

    if (!isOwner && membership?.role !== 'WORKSPACE_ADMIN') {
      throw new AppError('Workspace administrator privileges required to revoke invitations', 403);
    }

    if (!isOwner && membership?.role === 'WORKSPACE_ADMIN') {
      const permissions = resolveAdminPermissions(ws);
      if (!permissions.canInviteMembers && !permissions.canRemoveMembers) {
        throw new AppError('Workspace administrator does not have permission to revoke invitations', 403);
      }
    }

    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.workspaceId !== workspaceId) {
      throw new AppError('Invitation not found', 404);
    }

    if (invitation.status !== 'PENDING') {
      throw new AppError(`Cannot revoke an invitation that is already ${invitation.status.toLowerCase()}`, 400);
    }

    const revoked = await prisma.workspaceInvitation.update({
      where: { id: invitationId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });

    return { success: true, message: 'Invitation revoked successfully', id: revoked.id };
  }

  /**
   * List pending invitations sent to the authenticated user's email
   */
  async getUserPendingInvitations(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) throw new AppError('User not found', 404);

    const now = new Date();
    const invitations = await prisma.workspaceInvitation.findMany({
      where: {
        OR: [
          { invitedEmail: user.email.toLowerCase().trim() },
          { invitedUserId: userId },
        ],
        status: 'PENDING',
        expiresAt: { gt: now },
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            avatarUrl: true,
            isPersonal: true,
            owner: {
              select: { id: true, fullName: true, username: true, avatarUrl: true },
            },
          },
        },
        invitedBy: {
          select: { id: true, fullName: true, username: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invitations.map((inv) => ({
      id: inv.id,
      workspaceId: inv.workspaceId,
      workspace: inv.workspace,
      invitedBy: inv.invitedBy,
      role: inv.role,
      message: inv.message,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    }));
  }

  /**
   * Accept an invitation by ID or Token (Atomic transaction creating DIRECT WorkspaceMember)
   */
  async acceptInvitation(invitationIdOrToken: string, userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, username: true, isEmailVerified: true },
    });

    if (!user) throw new AppError('User not found', 404);

    if (!user.isEmailVerified) {
      throw new AppError(
        'You must verify your email address before accepting workspace invitations. Please check your inbox for the verification link.',
        403
      );
    }

    // Try finding by tokenHash first, then by id
    const candidateHash = crypto.createHash('sha256').update(invitationIdOrToken).digest('hex');
    let invitation = await prisma.workspaceInvitation.findFirst({
      where: {
        OR: [
          { tokenHash: candidateHash },
          { tokenHash: invitationIdOrToken },
          { id: invitationIdOrToken },
        ],
      },
      include: {
        workspace: {
          include: {
            owner: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!invitation) {
      throw new AppError('Invitation not found or invalid token', 404);
    }

    // Verify email match (normalized case-insensitive)
    if (invitation.invitedEmail.toLowerCase() !== user.email.toLowerCase()) {
      throw new AppError('This invitation was sent to a different email address', 403);
    }

    // Verify status is PENDING
    if (invitation.status !== 'PENDING') {
      throw new AppError(`This invitation has already been ${invitation.status.toLowerCase()}`, 400);
    }

    // Verify not expired
    if (new Date(invitation.expiresAt) < new Date()) {
      await prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw new AppError('This invitation has expired', 400);
    }

    // Check if user is already an active member
    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: invitation.workspaceId,
          userId,
        },
      },
    });

    if (existingMember) {
      await prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date(), invitedUserId: userId },
      });
      return {
        success: true,
        message: 'You are already a member of this workspace',
        workspace: invitation.workspace,
      };
    }

    // Atomic transaction: Re-verify status + create DIRECT WorkspaceMember
    const result = await prisma.$transaction(async (tx) => {
      const fresh = await tx.workspaceInvitation.findUnique({
        where: { id: invitation.id },
        select: { status: true, expiresAt: true },
      });

      if (!fresh || fresh.status !== 'PENDING') {
        throw new AppError(
          `This invitation has already been ${fresh ? fresh.status.toLowerCase() : 'processed'}`,
          400
        );
      }

      if (new Date(fresh.expiresAt) < new Date()) {
        await tx.workspaceInvitation.update({
          where: { id: invitation.id },
          data: { status: 'EXPIRED' },
        });
        throw new AppError('This invitation has expired', 400);
      }

      // Create WorkspaceMember with origin DIRECT
      const member = await tx.workspaceMember.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId,
          role: invitation.role,
          origin: 'DIRECT',
        },
      });

      // Mark invitation accepted
      await tx.workspaceInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          invitedUserId: userId,
        },
      });

      return member;
    });

    publishToUser(userId, 'WORKSPACE_MEMBER_JOINED', {
      workspaceId: invitation.workspaceId,
      role: result.role,
    });

    return {
      success: true,
      message: 'Workspace joined successfully',
      workspace: invitation.workspace,
      role: result.role,
    };
  }

  /**
   * Decline an invitation
   */
  async declineInvitation(invitationIdOrToken: string, userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) throw new AppError('User not found', 404);

    const candidateHash = crypto.createHash('sha256').update(invitationIdOrToken).digest('hex');
    const invitation = await prisma.workspaceInvitation.findFirst({
      where: {
        OR: [
          { tokenHash: candidateHash },
          { tokenHash: invitationIdOrToken },
          { id: invitationIdOrToken },
        ],
      },
    });

    if (!invitation) {
      throw new AppError('Invitation not found', 404);
    }

    if (invitation.invitedEmail.toLowerCase() !== user.email.toLowerCase()) {
      throw new AppError('This invitation was sent to a different email address', 403);
    }

    if (invitation.status !== 'PENDING') {
      throw new AppError(`This invitation has already been ${invitation.status.toLowerCase()}`, 400);
    }

    await prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'DECLINED',
        declinedAt: new Date(),
      },
    });

    return { success: true, message: 'Invitation declined' };
  }
}

export const workspaceInvitationService = new WorkspaceInvitationService();
