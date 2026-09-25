import { prisma } from '../prisma.js';
import { AppError } from '../middlewares/error.middleware.js';
import { CreateInvitationInput } from '../schemas/invitation.schema.js';
import { sendInvitationEmail, sendProjectJoinedConfirmationEmail } from './email.service.js';
import { activityService } from './activity.service.js';
import { notificationService } from './notification.service.js';
import { publishToProject, publishToUser } from '../realtime/realtime.service.js';
import { enqueueEmailJob } from '../jobs/queues.js';
import { ActivityType, InvitationStatus } from '../generated/prisma/index.js';

export class InvitationService {
  /**
   * Helper to verify if user is admin on project
   */
  private static async verifyProjectAdmin(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: { where: { userId } },
        createdBy: { select: { id: true, fullName: true, username: true } },
      },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const isOwner = project.createdById === userId;
    const membership = project.members[0];

    if (!isOwner && membership?.role !== 'PROJECT_ADMIN') {
      throw new AppError('Only project administrators can manage invitations', 403);
    }

    return { project };
  }

  /**
   * Create an email invitation to a project
   */
  static async createInvitation(projectId: string, actorId: string, input: CreateInvitationInput) {
    const { project } = await this.verifyProjectAdmin(projectId, actorId);

    if (project.status === 'ARCHIVED') {
      throw new AppError('Cannot invite members to an archived project', 400);
    }

    const normalizedEmail = input.email.toLowerCase().trim();

    // 1. Fetch actor details
    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { fullName: true, username: true, email: true },
    });

    if (actor && actor.email.toLowerCase() === normalizedEmail) {
      throw new AppError('You cannot invite yourself to the project', 400);
    }

    // 2. Check if a user with this email is ALREADY an active project member
    const existingMemberUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        memberships: {
          where: { projectId },
        },
      },
    });

    if (
      (existingMemberUser && existingMemberUser.memberships.length > 0) ||
      project.createdById === existingMemberUser?.id
    ) {
      throw new AppError('This user is already a member of this project', 400);
    }

    // 3. Check for existing active PENDING invitation
    const existingPending = await prisma.invitation.findFirst({
      where: {
        projectId,
        invitedEmail: normalizedEmail,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });

    if (existingPending) {
      throw new AppError('A pending invitation has already been sent to this email address', 400);
    }

    // 4. Create new invitation with 7-day expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await prisma.invitation.create({
      data: {
        projectId,
        invitedEmail: normalizedEmail,
        invitedUserId: existingMemberUser?.id || null,
        invitedById: actorId,
        role: input.role || 'PROJECT_MEMBER',
        message: input.message ? input.message.trim() : null,
        status: 'PENDING',
        expiresAt,
      },
      include: {
        invitedBy: {
          select: { id: true, fullName: true, username: true },
        },
      },
    });

    // 5. Dispatch email via BullMQ
    await enqueueEmailJob({
      type: 'PROJECT_INVITATION',
      toEmail: normalizedEmail,
      inviterName: actor?.fullName || actor?.username || 'A team member',
      projectName: project.name,
      projectKey: project.key,
      role: invitation.role,
      message: invitation.message,
      expiresAt: expiresAt.toISOString(),
    });

    // 6. In-app notification if invited user exists in system
    if (existingMemberUser && existingMemberUser.id !== actorId) {
      await notificationService.createNotification({
        recipientId: existingMemberUser.id,
        actorId,
        projectId,
        type: 'PROJECT_INVITED',
        title: 'Project Invitation',
        message: `${actor?.fullName || actor?.username || 'Someone'} invited you to join "${project.name}"`,
        link: '/app/invitations',
      });

      publishToUser(existingMemberUser.id, 'INVITATION_CREATED', {
        projectId,
        invitationId: invitation.id,
        actorId,
        actorName: actor?.fullName || actor?.username || null,
      });
    }

    return invitation;
  }

  /**
   * Get all invitations for a project (Admin only)
   */
  static async getProjectInvitations(projectId: string, actorId: string) {
    await this.verifyProjectAdmin(projectId, actorId);

    const invitations = await prisma.invitation.findMany({
      where: { projectId },
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

    return invitations;
  }

  /**
   * Resend a pending invitation (Admin only)
   */
  static async resendInvitation(projectId: string, invitationId: string, actorId: string) {
    const { project } = await this.verifyProjectAdmin(projectId, actorId);

    if (project.status === 'ARCHIVED') {
      throw new AppError('Cannot resend invitations for an archived project', 400);
    }

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.projectId !== projectId) {
      throw new AppError('Invitation not found', 404);
    }

    // Only allow resend for PENDING or EXPIRED invitations
    if (invitation.status !== 'PENDING' && invitation.status !== 'EXPIRED') {
      throw new AppError(`Cannot resend an invitation that is already ${invitation.status.toLowerCase()}`, 400);
    }

    // Rate limiting: prevent spamming resend within 60 seconds
    const nowMs = Date.now();
    if (invitation.updatedAt && nowMs - new Date(invitation.updatedAt).getTime() < 60 * 1000) {
      throw new AppError('Please wait 60 seconds before resending this invitation', 429);
    }

    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { fullName: true, username: true },
    });

    // Extend expiry by 7 days from now and ensure status is PENDING
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    const updated = await prisma.invitation.update({
      where: { id: invitationId },
      data: {
        status: 'PENDING',
        expiresAt: newExpiresAt,
      },
      include: {
        invitedBy: {
          select: { id: true, fullName: true, username: true },
        },
      },
    });

    // Dispatch fresh email via BullMQ
    await enqueueEmailJob({
      type: 'PROJECT_INVITATION',
      toEmail: invitation.invitedEmail,
      inviterName: actor?.fullName || actor?.username || 'A team member',
      projectName: project.name,
      projectKey: project.key,
      role: invitation.role,
      message: invitation.message,
      expiresAt: newExpiresAt.toISOString(),
    });

    return updated;
  }

  /**
   * Cancel a pending invitation (Admin only)
   */
  static async cancelInvitation(projectId: string, invitationId: string, actorId: string) {
    await this.verifyProjectAdmin(projectId, actorId);

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.projectId !== projectId) {
      throw new AppError('Invitation not found', 404);
    }

    if (invitation.status !== 'PENDING') {
      throw new AppError(`Cannot cancel an invitation that is already ${invitation.status.toLowerCase()}`, 400);
    }

    const cancelled = await prisma.invitation.update({
      where: { id: invitationId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    return cancelled;
  }

  /**
   * Get all invitations for the authenticated user
   */
  static async getUserInvitations(userId: string, filterStatus?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const normalizedEmail = user.email.toLowerCase();
    const where: any = {
      OR: [{ invitedEmail: normalizedEmail }, { invitedUserId: userId }],
    };

    if (filterStatus && filterStatus !== 'ALL') {
      where.status = filterStatus as InvitationStatus;
    }

    const invitations = await prisma.invitation.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            key: true,
            description: true,
            avatarUrl: true,
            category: true,
          },
        },
        invitedBy: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Mark any passed pending invitations as expired on read
    const now = new Date();
    const formatted = invitations.map((inv) => {
      let currentStatus = inv.status;
      if (inv.status === 'PENDING' && new Date(inv.expiresAt) < now) {
        currentStatus = 'EXPIRED';
      }
      return {
        ...inv,
        status: currentStatus,
        isExpired: new Date(inv.expiresAt) < now,
      };
    });

    return formatted;
  }

  /**
   * Accept an invitation (Atomic transaction creating ProjectMember)
   */
  static async acceptInvitation(invitationId: string, userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, username: true, isEmailVerified: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (!user.isEmailVerified) {
      throw new AppError('You must verify your email address before accepting project invitations. Please check your inbox for the verification link.', 403);
    }

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: { project: true },
    });

    if (!invitation) {
      throw new AppError('Invitation not found', 404);
    }

    // Verify email match
    if (invitation.invitedEmail.toLowerCase() !== user.email.toLowerCase()) {
      throw new AppError('This invitation was sent to a different email address', 403);
    }

    // Verify status is PENDING
    if (invitation.status !== 'PENDING') {
      throw new AppError(`This invitation has already been ${invitation.status.toLowerCase()}`, 400);
    }

    // Verify not expired
    if (new Date(invitation.expiresAt) < new Date()) {
      await prisma.invitation.update({
        where: { id: invitationId },
        data: { status: 'EXPIRED' },
      });
      throw new AppError('This invitation has expired', 400);
    }

    // Check if already a member (prevent race conditions)
    const existingMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: invitation.projectId,
          userId,
        },
      },
    });

    if (existingMember) {
      // Mark as accepted and return existing membership
      await prisma.invitation.update({
        where: { id: invitationId },
        data: { status: 'ACCEPTED', acceptedAt: new Date(), invitedUserId: userId },
      });
      return { success: true, message: 'You are already a member of this project' };
    }

    // Atomically create ProjectMember and update Invitation
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create ProjectMember
      const member = await tx.projectMember.create({
        data: {
          projectId: invitation.projectId,
          userId,
          role: invitation.role,
        },
      });

      // 2. Update Invitation status
      await tx.invitation.update({
        where: { id: invitationId },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          invitedUserId: userId,
        },
      });

      // 3. Log MEMBER_ADDED activity
      await activityService.createActivity(
        {
          projectId: invitation.projectId,
          actorId: userId,
          type: ActivityType.MEMBER_ADDED,
          metadata: {
            userName: user.fullName || user.username,
            role: invitation.role,
          },
        },
        tx
      );

      // 4. Notify inviter of acceptance
      if (invitation.invitedById && invitation.invitedById !== userId) {
        await notificationService.createNotification(
          {
            recipientId: invitation.invitedById,
            actorId: userId,
            projectId: invitation.projectId,
            type: 'INVITATION_ACCEPTED',
            title: 'Invitation accepted',
            message: `${user.fullName || user.username} accepted the invitation to "${invitation.project.name}"`,
            link: `/app/projects/${invitation.projectId}/members`,
          },
          tx
        );
      }

      return {
        success: true,
        message: `Successfully joined ${invitation.project.name}`,
        project: invitation.project,
        member,
      };
    });

    publishToProject(invitation.projectId, 'MEMBER_ADDED', {
      projectId: invitation.projectId,
      actorId: userId,
      actorName: user.fullName || user.username || null,
    });

    // Send confirmation email to user asynchronously
    sendProjectJoinedConfirmationEmail({
      toEmail: user.email,
      username: user.fullName || user.username,
      projectName: invitation.project.name,
      role: invitation.role,
    }).catch((err) => console.error('[InvitationService] Failed to send joined confirmation email:', err));

    return result;
  }

  /**
   * Link any pending invitations sent to an unregistered email when the user registers or logs in
   */
  static async linkPendingInvitationsForUser(email: string, userId: string) {
    if (!email || !userId) return;
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const pendingInvitations = await prisma.invitation.findMany({
        where: {
          invitedEmail: normalizedEmail,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
        include: {
          project: true,
          invitedBy: true,
        },
      });

      if (pendingInvitations.length === 0) return;

      for (const inv of pendingInvitations) {
        // 1. Link invitedUserId to new user
        await prisma.invitation.update({
          where: { id: inv.id },
          data: { invitedUserId: userId },
        });

        // 2. Create in-app notification so user sees it in notifications & dashboard
        await notificationService.createNotification({
          recipientId: userId,
          actorId: inv.invitedById,
          projectId: inv.projectId,
          type: 'PROJECT_INVITED',
          title: 'Project Invitation',
          message: `${inv.invitedBy?.fullName || inv.invitedBy?.username || 'Someone'} invited you to join "${inv.project.name}"`,
          link: '/app/invitations',
        });

        publishToUser(userId, 'INVITATION_CREATED', {
          projectId: inv.projectId,
          invitationId: inv.id,
          actorId: inv.invitedById,
          actorName: inv.invitedBy?.fullName || inv.invitedBy?.username || null,
        });
      }
    } catch (err) {
      console.error('[InvitationService] linkPendingInvitationsForUser error:', err);
    }
  }

  /**
   * Decline an invitation
   */
  static async declineInvitation(invitationId: string, userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
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

    await prisma.invitation.update({
      where: { id: invitationId },
      data: {
        status: 'DECLINED',
        declinedAt: new Date(),
        invitedUserId: userId,
      },
    });

    return { success: true, message: 'Invitation declined' };
  }

  /**
   * Get pending invitations count for sidebar badge
   */
  static async getPendingCount(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) return { count: 0 };

    const count = await prisma.invitation.count({
      where: {
        OR: [{ invitedEmail: user.email.toLowerCase() }, { invitedUserId: userId }],
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });

    return { count };
  }
}

export const invitationService = InvitationService;
