import prisma from '../prisma.js';
import { AppError } from '../middlewares/error.middleware.js';
import { resolveAdminPermissions, resolveFullWorkspacePermissions } from '../schemas/workspace.schema.js';
import { evictUserFromProjectRoom } from '../realtime/realtime.service.js';
import { workspaceAuditService } from './workspaceAudit.service.js';
import type { WorkspaceRole } from '../generated/prisma/index.js';

export interface GetWorkspaceMembersOptions {
  page?: number;
  limit?: number;
  search?: string;
  role?: WorkspaceRole;
}

export class WorkspaceMemberService {
  /**
   * List members for a workspace with pagination, search, and role filtering.
   */
  async getWorkspaceMembers(
    workspaceId: string,
    actorId: string,
    options: GetWorkspaceMembersOptions = {}
  ) {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: { where: { userId: actorId } },
      },
    });

    if (!ws) throw new AppError('Workspace not found', 404);

    const isOwner = ws.ownerId === actorId;
    const membership = ws.members[0];

    if (!isOwner && !membership) {
      throw new AppError('You are not authorized to view members of this workspace', 403);
    }

    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = { workspaceId };

    if (options.role) {
      where.role = options.role;
    }

    if (options.search && options.search.trim()) {
      const q = options.search.trim();
      where.user = {
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { username: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      };
    }

    const [members, total] = await Promise.all([
      prisma.workspaceMember.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              username: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: [
          { role: 'asc' }, // OWNER -> WORKSPACE_ADMIN -> WORKSPACE_MEMBER
          { joinedAt: 'asc' },
        ],
        skip,
        take: limit,
      }),
      prisma.workspaceMember.count({ where }),
    ]);

    const roleHierarchy: Record<string, number> = {
      OWNER: 1,
      WORKSPACE_ADMIN: 2,
      PROJECT_ADMIN: 3,
      WORKSPACE_MEMBER: 4,
    };

    const mappedMembers = members.map((m) => ({
      id: m.id,
      workspaceId: m.workspaceId,
      userId: m.userId,
      role: m.role,
      origin: m.origin,
      joinedAt: m.joinedAt,
      user: m.user,
      isOwner: m.userId === ws.ownerId || m.role === 'OWNER',
    }));

    mappedMembers.sort((a, b) => {
      const pA = a.isOwner || a.role === 'OWNER' ? 1 : (roleHierarchy[a.role] ?? 99);
      const pB = b.isOwner || b.role === 'OWNER' ? 1 : (roleHierarchy[b.role] ?? 99);
      if (pA !== pB) return pA - pB;
      return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
    });

    return {
      members: mappedMembers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Update a workspace member's role (Owner or Admin with canManageRoles)
   */
  async updateMemberRole(
    workspaceId: string,
    targetMemberId: string,
    newRole: WorkspaceRole,
    actorId: string
  ) {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: { where: { userId: actorId } },
      },
    });

    if (!ws) throw new AppError('Workspace not found', 404);

    if (ws.isPersonal) {
      throw new AppError('Cannot modify member roles in a personal workspace', 400);
    }

    const isOwner = ws.ownerId === actorId;
    const actorMembership = ws.members[0];

    if (!isOwner && !actorMembership) {
      throw new AppError('You are not authorized to modify member roles', 403);
    }

    const actorRole = isOwner ? 'OWNER' : actorMembership.role;

    if (actorRole === 'WORKSPACE_MEMBER' || actorRole === 'PROJECT_ADMIN') {
      throw new AppError('Only workspace owners and authorized workspace administrators can modify member roles', 403);
    }

    if (actorRole === 'WORKSPACE_ADMIN') {
      const permissions = resolveFullWorkspacePermissions(ws);
      if (!permissions.workspaceAdmin.canManageRoles) {
        throw new AppError('Workspace administrator does not have permission to manage member roles', 403);
      }
    }

    // Role elevation safeguards:
    if (newRole === 'OWNER') {
      throw new AppError('Workspace ownership cannot be assigned through member role management', isOwner ? 400 : 403);
    }

    const targetMember = await prisma.workspaceMember.findUnique({
      where: { id: targetMemberId },
      include: {
        user: { select: { id: true, fullName: true, username: true, email: true, avatarUrl: true } },
      },
    });

    if (!targetMember || targetMember.workspaceId !== workspaceId) {
      throw new AppError('Member not found in this workspace', 404);
    }

    // Self-promotion / self-demotion protection
    if (targetMember.userId === actorId) {
      throw new AppError('You cannot modify your own role', 400);
    }

    // Owner protection
    if (targetMember.role === 'OWNER' || targetMember.userId === ws.ownerId) {
      throw new AppError('Cannot modify the workspace owner role', 400);
    }

    // Workspace Admin cannot demote other Admins unless Owner
    if (actorRole === 'WORKSPACE_ADMIN' && targetMember.role === 'WORKSPACE_ADMIN') {
      throw new AppError('Only the workspace owner can modify administrator roles', 403);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.workspaceMember.update({
        where: { id: targetMemberId },
        data: { role: newRole },
        include: {
          user: { select: { id: true, fullName: true, username: true, email: true, avatarUrl: true } },
        },
      });

      await workspaceAuditService.logAuditEvent(tx, {
        workspaceId,
        actorId,
        action: 'MEMBER_ROLE_UPDATED',
        targetType: 'MEMBER',
        targetId: targetMemberId,
        metadata: {
          targetUserId: targetMember.userId,
          previousRole: targetMember.role,
          newRole,
        },
      });

      return res;
    });

    return {
      id: updated.id,
      workspaceId: updated.workspaceId,
      userId: updated.userId,
      role: updated.role,
      origin: updated.origin,
      joinedAt: updated.joinedAt,
      user: updated.user,
      isOwner: false,
    };
  }

  /**
   * Remove a member from the workspace (Owner or Admin with canRemoveMembers)
   */
  async removeMember(workspaceId: string, targetMemberId: string, actorId: string) {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: { where: { userId: actorId } },
      },
    });

    if (!ws) throw new AppError('Workspace not found', 404);

    if (ws.isPersonal) {
      throw new AppError('Cannot remove members from a personal workspace', 400);
    }

    const isOwner = ws.ownerId === actorId;
    const actorMembership = ws.members[0];

    if (!isOwner && !actorMembership) {
      throw new AppError('You are not authorized to remove workspace members', 403);
    }

    const actorRole = isOwner ? 'OWNER' : actorMembership.role;

    if (actorRole === 'WORKSPACE_MEMBER' || actorRole === 'PROJECT_ADMIN') {
      throw new AppError('Only workspace owners and authorized workspace administrators can remove members', 403);
    }

    if (actorRole === 'WORKSPACE_ADMIN') {
      const permissions = resolveFullWorkspacePermissions(ws);
      if (!permissions.workspaceAdmin.canRemoveMembers) {
        throw new AppError('Workspace administrator does not have permission to remove members', 403);
      }
    }

    const targetMember = await prisma.workspaceMember.findUnique({
      where: { id: targetMemberId },
      include: {
        user: { select: { id: true, fullName: true, username: true, email: true } },
      },
    });

    if (!targetMember || targetMember.workspaceId !== workspaceId) {
      throw new AppError('Member not found in this workspace', 404);
    }

    // Owner protection
    if (targetMember.role === 'OWNER' || targetMember.userId === ws.ownerId) {
      throw new AppError('Cannot remove the workspace owner', 400);
    }

    // Self-removal protection via management endpoint
    if (targetMember.userId === actorId) {
      throw new AppError('You cannot remove yourself through the member management endpoint', 400);
    }

    // Workspace Admin cannot remove other Admins (only Owner can)
    if (actorRole === 'WORKSPACE_ADMIN' && targetMember.role === 'WORKSPACE_ADMIN') {
      throw new AppError('Only the workspace owner can remove administrator members', 403);
    }

    // Fetch all project IDs in this workspace for cascading cleanup & room eviction
    const wsProjects = await prisma.project.findMany({
      where: { workspaceId },
      select: { id: true },
    });
    const projectIds = wsProjects.map((p) => p.id);

    // Atomic transaction for removal & cascade cleanup
    await prisma.$transaction(async (tx) => {
      // 1. Unassign target member from all work items in this workspace (preserves work item & creator attribution)
      if (projectIds.length > 0) {
        await tx.workItem.updateMany({
          where: {
            projectId: { in: projectIds },
            assignedToId: targetMember.userId,
          },
          data: { assignedToId: null },
        });

        // 2. Remove user from all projects in this workspace
        await tx.projectMember.deleteMany({
          where: {
            projectId: { in: projectIds },
            userId: targetMember.userId,
          },
        });

        // 3. Invalidate/cancel any pending project invitations for this member in this workspace
        await tx.invitation.updateMany({
          where: {
            projectId: { in: projectIds },
            OR: [
              { invitedUserId: targetMember.userId },
              { invitedEmail: targetMember.user.email.toLowerCase() },
            ],
            status: 'PENDING',
          },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
          },
        });
      }

      // 4. Delete workspace member record
      await tx.workspaceMember.delete({
        where: { id: targetMemberId },
      });

      // 4. Record audit event
      await workspaceAuditService.logAuditEvent(tx, {
        workspaceId,
        actorId,
        action: 'MEMBER_REMOVED',
        targetType: 'MEMBER',
        targetId: targetMemberId,
        metadata: {
          targetUserId: targetMember.userId,
          removedRole: targetMember.role,
        },
      });
    });

    // Post-commit: evict user from active Socket.IO rooms for all projects in this workspace
    for (const pid of projectIds) {
      await evictUserFromProjectRoom(targetMember.userId, pid).catch(() => {});
    }

    return {
      success: true,
      message: 'Member removed from workspace successfully',
      removedUserId: targetMember.userId,
    };
  }

  /**
   * Voluntarily leave a workspace (Non-owners only)
   */
  async leaveWorkspace(workspaceId: string, userId: string) {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: { where: { userId } },
      },
    });

    if (!ws) throw new AppError('Workspace not found', 404);

    if (ws.isPersonal) {
      throw new AppError('Cannot leave your personal workspace', 400);
    }

    if (ws.ownerId === userId) {
      throw new AppError('Workspace owners cannot leave their workspace. Transfer ownership or delete the workspace instead.', 400);
    }

    const membership = ws.members[0];
    if (!membership) {
      throw new AppError('You are not a member of this workspace', 404);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    // Fetch all project IDs in this workspace for cascading cleanup & room eviction
    const wsProjects = await prisma.project.findMany({
      where: { workspaceId },
      select: { id: true },
    });
    const projectIds = wsProjects.map((p) => p.id);

    // Atomic transaction for leaving & cascade cleanup
    await prisma.$transaction(async (tx) => {
      // 1. Unassign leaving member from all work items in this workspace (preserves work item & creator attribution)
      if (projectIds.length > 0) {
        await tx.workItem.updateMany({
          where: {
            projectId: { in: projectIds },
            assignedToId: userId,
          },
          data: { assignedToId: null },
        });

        // 2. Remove user from all projects in this workspace
        await tx.projectMember.deleteMany({
          where: {
            projectId: { in: projectIds },
            userId: userId,
          },
        });

        // 3. Invalidate/cancel any pending project invitations for this member in this workspace
        if (user?.email) {
          await tx.invitation.updateMany({
            where: {
              projectId: { in: projectIds },
              OR: [
                { invitedUserId: userId },
                { invitedEmail: user.email.toLowerCase() },
              ],
              status: 'PENDING',
            },
            data: {
              status: 'CANCELLED',
              cancelledAt: new Date(),
            },
          });
        }
      }

      // 4. Delete workspace member record
      await tx.workspaceMember.delete({
        where: { id: membership.id },
      });

      // 5. Record audit event
      await workspaceAuditService.logAuditEvent(tx, {
        workspaceId,
        actorId: userId,
        action: 'MEMBER_REMOVED',
        targetType: 'MEMBER',
        targetId: membership.id,
        metadata: {
          targetUserId: userId,
          removedRole: membership.role,
          leftSelf: true,
        },
      });
    });

    // Post-commit: evict user from active Socket.IO rooms for all projects in this workspace
    for (const pid of projectIds) {
      await evictUserFromProjectRoom(userId, pid).catch(() => {});
    }

    return {
      success: true,
      message: 'You have successfully left the workspace',
    };
  }
}

export const workspaceMemberService = new WorkspaceMemberService();
