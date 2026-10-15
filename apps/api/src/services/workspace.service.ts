import crypto from 'node:crypto';
import prisma from '../prisma.js';
import { AppError } from '../middlewares/error.middleware.js';
import { workspaceAuditService } from './workspaceAudit.service.js';
import { cacheService } from '../redis/cache.service.js';
import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  WorkspaceAdminPermissions,
  UpdateWorkspaceAdminPermissionsInput,
} from '../schemas/workspace.schema.js';
import { resolveAdminPermissions } from '../schemas/workspace.schema.js';
import type { WorkspaceRole } from '../generated/prisma/index.js';

export interface WorkspaceSummaryDto {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  ownerId: string;
  isPersonal: boolean;
  maxMembers?: number | null;
  isOwner: boolean;
  userRole: WorkspaceRole;
  memberCount: number;
  projectCount: number;
  adminPermissions?: WorkspaceAdminPermissions;
  deletedAt?: Date | null;
  deletionScheduledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: string;
    fullName: string | null;
    username: string;
    avatarUrl: string | null;
  };
}

export interface DeletedWorkspaceDto {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  isPersonal: boolean;
  deletedAt: Date;
  deletionScheduledAt: Date;
  daysRemaining: number;
}

export class WorkspaceService {
  /**
   * Get all workspaces the authenticated user has access to,
   * categorized into 'owned' (My Workspaces) and 'joined' (Team Workspaces).
   * Soft-deleted workspaces are strictly excluded from normal listings.
   */
  async getUserWorkspaces(userId: string): Promise<{
    owned: WorkspaceSummaryDto[];
    joined: WorkspaceSummaryDto[];
  }> {
    const memberships = await prisma.workspaceMember.findMany({
      where: {
        userId,
        workspace: { deletedAt: null },
      },
      include: {
        workspace: {
          include: {
            owner: {
              select: { id: true, fullName: true, username: true, avatarUrl: true },
            },
            _count: {
              select: { members: true, projects: true },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const formatted: WorkspaceSummaryDto[] = await Promise.all(
      memberships.map(async (m) => {
        const ws = m.workspace;
        const isOwner = ws.ownerId === userId;
        const isPrivileged = isOwner || m.role === 'WORKSPACE_ADMIN';

        let projectCount = ws._count.projects;
        let memberCount = ws._count.members;

        // Non-privileged members only see counts of projects and members they are authorized to access
        if (!isPrivileged) {
          const accessibleProjects = await prisma.project.findMany({
            where: {
              workspaceId: ws.id,
              OR: [
                ...(ws.isPersonal ? [] : [{ visibility: 'WORKSPACE' as const }]),
                { createdById: userId },
                { members: { some: { userId } } },
              ],
            },
            select: {
              id: true,
              members: { select: { userId: true } },
            },
          });

          projectCount = accessibleProjects.length;

          const visibleMemberIds = new Set<string>();
          visibleMemberIds.add(ws.ownerId);
          visibleMemberIds.add(userId);
          for (const p of accessibleProjects) {
            for (const member of p.members) {
              visibleMemberIds.add(member.userId);
            }
          }
          memberCount = visibleMemberIds.size;
        }

        return {
          id: ws.id,
          name: ws.name,
          slug: ws.slug,
          avatarUrl: ws.avatarUrl,
          ownerId: ws.ownerId,
          isPersonal: ws.isPersonal,
          maxMembers: ws.maxMembers,
          isOwner,
          userRole: m.role,
          memberCount,
          projectCount,
          createdAt: ws.createdAt,
          updatedAt: ws.updatedAt,
          owner: ws.owner,
        };
      })
    );

    // Owned: where ownerId === userId (Personal workspace first, then by updatedAt desc)
    const owned = formatted
      .filter((w) => w.isOwner)
      .sort((a, b) => {
        if (a.isPersonal && !b.isPersonal) return -1;
        if (!a.isPersonal && b.isPersonal) return 1;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      });

    // Joined: where ownerId !== userId
    const joined = formatted
      .filter((w) => !w.isOwner)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return { owned, joined };
  }

  /**
   * Retrieve single workspace details if caller has verified access.
   */
  async getWorkspaceById(workspaceId: string, userId: string): Promise<WorkspaceSummaryDto> {
    if (!workspaceId || typeof workspaceId !== 'string') {
      throw new AppError('Invalid workspace ID', 400);
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
      include: {
        workspace: {
          include: {
            owner: {
              select: { id: true, fullName: true, username: true, avatarUrl: true },
            },
            _count: {
              select: { members: true, projects: true },
            },
          },
        },
      },
    });

    if (!membership) {
      throw new AppError('You are not authorized to access this workspace', 403);
    }

    if (membership.workspace.deletedAt) {
      throw new AppError('Workspace not found', 404);
    }

    const ws = membership.workspace;
    const isOwner = ws.ownerId === userId;
    const isPrivileged = isOwner || membership.role === 'WORKSPACE_ADMIN';

    let projectCount = ws._count.projects;
    let memberCount = ws._count.members;

    if (!isPrivileged) {
      const accessibleProjects = await prisma.project.findMany({
        where: {
          workspaceId: ws.id,
          OR: [
            ...(ws.isPersonal ? [] : [{ visibility: 'WORKSPACE' as const }]),
            { createdById: userId },
            { members: { some: { userId } } },
          ],
        },
        select: {
          id: true,
          members: { select: { userId: true } },
        },
      });

      projectCount = accessibleProjects.length;

      const visibleMemberIds = new Set<string>();
      visibleMemberIds.add(ws.ownerId);
      visibleMemberIds.add(userId);
      for (const p of accessibleProjects) {
        for (const member of p.members) {
          visibleMemberIds.add(member.userId);
        }
      }
      memberCount = visibleMemberIds.size;
    }

    return {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      avatarUrl: ws.avatarUrl,
      ownerId: ws.ownerId,
      isPersonal: ws.isPersonal,
      maxMembers: ws.maxMembers,
      isOwner,
      userRole: membership.role,
      memberCount,
      projectCount,
      adminPermissions: resolveAdminPermissions(ws),
      createdAt: ws.createdAt,
      updatedAt: ws.updatedAt,
      owner: ws.owner,
    };
  }

  /**
   * Create a new team workspace with the caller as OWNER.
   */
  async createWorkspace(userId: string, data: CreateWorkspaceInput): Promise<WorkspaceSummaryDto> {
    const trimmedName = data.name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      throw new AppError('Workspace name must be at least 2 characters', 400);
    }

    const cleanStem = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 30) || 'workspace';
    const entropy = crypto.randomBytes(4).toString('hex');
    const slug = `${cleanStem}-${entropy}`;

    const created = await prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: {
          name: trimmedName,
          slug,
          avatarUrl: data.avatarUrl || null,
          maxMembers: data.maxMembers ?? null,
          ownerId: userId,
          isPersonal: false,
        },
        include: {
          owner: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          _count: {
            select: { members: true, projects: true },
          },
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: ws.id,
          userId,
          role: 'OWNER',
        },
      });

      return ws;
    });

    return {
      id: created.id,
      name: created.name,
      slug: created.slug,
      avatarUrl: created.avatarUrl,
      ownerId: created.ownerId,
      isPersonal: created.isPersonal,
      maxMembers: created.maxMembers,
      isOwner: true,
      userRole: 'OWNER',
      memberCount: 1,
      projectCount: 0,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      owner: created.owner,
    };
  }

  /**
   * Update workspace details and active member limit (Strictly Workspace Owner only).
   */
  async updateWorkspace(
    workspaceId: string,
    userId: string,
    data: UpdateWorkspaceInput,
    reqMeta?: { ipAddress?: string; userAgent?: string }
  ): Promise<WorkspaceSummaryDto> {
    if (!workspaceId || typeof workspaceId !== 'string') {
      throw new AppError('Invalid workspace ID', 400);
    }

    const updateData: any = {};
    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (trimmed.length < 2) {
        throw new AppError('Workspace name must be at least 2 characters', 400);
      }
      updateData.name = trimmed;
    }
    if (data.avatarUrl !== undefined) {
      updateData.avatarUrl = data.avatarUrl;
    }
    if (data.maxMembers !== undefined) {
      updateData.maxMembers = data.maxMembers;
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Lock workspace row FOR UPDATE to serialize capacity changes and updates
      const [ws] = await tx.$queryRaw<
        Array<{
          id: string;
          name: string;
          slug: string;
          ownerId: string;
          isPersonal: boolean;
          maxMembers: number | null;
          deletedAt: Date | null;
        }>
      >`
        SELECT id, name, slug, "ownerId", "isPersonal", "maxMembers", "deletedAt"
        FROM "Workspace"
        WHERE id = ${workspaceId}
        FOR UPDATE
      `;

      if (!ws) throw new AppError('Workspace not found', 404);
      if (ws.deletedAt) throw new AppError('Cannot update a deleted workspace', 400);

      if (ws.ownerId !== userId) {
        throw new AppError('Only the workspace owner can modify workspace settings', 403);
      }

      if (ws.isPersonal && data.maxMembers !== undefined && data.maxMembers !== null) {
        throw new AppError('Personal workspaces do not support member limits', 400);
      }

      if (data.maxMembers !== undefined && data.maxMembers !== null) {
        const activeMemberCount = await tx.workspaceMember.count({
          where: { workspaceId },
        });
        if (data.maxMembers < activeMemberCount) {
          throw new AppError(
            `Cannot set member limit to ${data.maxMembers}. The workspace currently has ${activeMemberCount} active members.`,
            400
          );
        }
      }

      const res = await tx.workspace.update({
        where: { id: workspaceId },
        data: updateData,
        include: {
          owner: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
          _count: { select: { members: true, projects: true } },
        },
      });

      await workspaceAuditService.logAuditEvent(tx, {
        workspaceId,
        actorId: userId,
        action: 'WORKSPACE_UPDATED',
        targetType: 'WORKSPACE',
        targetId: workspaceId,
        metadata: {
          updatedFields: Object.keys(updateData),
          maxMembers: updateData.maxMembers,
        },
        ipAddress: reqMeta?.ipAddress,
        userAgent: reqMeta?.userAgent,
      });

      return res;
    });

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      avatarUrl: updated.avatarUrl,
      ownerId: updated.ownerId,
      isPersonal: updated.isPersonal,
      maxMembers: updated.maxMembers,
      isOwner: true,
      userRole: 'OWNER',
      memberCount: updated._count.members,
      projectCount: updated._count.projects,
      adminPermissions: resolveAdminPermissions(updated),
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      owner: updated.owner,
    };
  }

  /**
   * Verify that a user is an active member or owner of a given workspace.
   * Throws 403 Forbidden if unauthorized.
   */
  async verifyWorkspaceAccess(
    workspaceId: string,
    userId: string
  ): Promise<{ workspaceId: string; role: WorkspaceRole; isOwner: boolean }> {
    if (!workspaceId || typeof workspaceId !== 'string') {
      throw new AppError('Workspace ID is required', 400);
    }

    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
      include: {
        workspace: { select: { id: true, ownerId: true, deletedAt: true } },
      },
    });

    if (!member) {
      throw new AppError('You do not have access to this workspace', 403);
    }

    if (member.workspace.deletedAt) {
      throw new AppError('This workspace has been deleted', 404);
    }

    return {
      workspaceId: member.workspaceId,
      role: member.role,
      isOwner: member.workspace.ownerId === userId,
    };
  }

  /**
   * Get workspace admin permissions (Accessible to any workspace member)
   */
  async getAdminPermissions(workspaceId: string, userId: string): Promise<WorkspaceAdminPermissions> {
    await this.verifyWorkspaceAccess(workspaceId, userId);

    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { isPersonal: true, adminPermissions: true },
    });

    if (!ws) throw new AppError('Workspace not found', 404);

    return resolveAdminPermissions(ws);
  }

  /**
   * Update workspace admin permissions (Strictly Workspace Owner only)
   */
  async updateAdminPermissions(
    workspaceId: string,
    userId: string,
    input: UpdateWorkspaceAdminPermissionsInput,
    reqMeta?: { ipAddress?: string; userAgent?: string }
  ): Promise<WorkspaceAdminPermissions> {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!ws) throw new AppError('Workspace not found', 404);
    if (ws.deletedAt) throw new AppError('Cannot update permissions on a deleted workspace', 400);

    if (ws.isPersonal) {
      throw new AppError('Personal workspaces do not support administrator delegation', 400);
    }

    if (ws.ownerId !== userId) {
      throw new AppError('Only the workspace owner can modify administrator permissions', 403);
    }

    const current = resolveAdminPermissions(ws);
    const updated = {
      canInviteMembers: input.canInviteMembers !== undefined ? input.canInviteMembers : current.canInviteMembers,
      canRemoveMembers: input.canRemoveMembers !== undefined ? input.canRemoveMembers : current.canRemoveMembers,
      canCreateProjects: input.canCreateProjects !== undefined ? input.canCreateProjects : current.canCreateProjects,
      canManageRoles: input.canManageRoles !== undefined ? input.canManageRoles : current.canManageRoles,
    };

    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({
        where: { id: workspaceId },
        data: { adminPermissions: updated },
      });

      await workspaceAuditService.logAuditEvent(tx, {
        workspaceId,
        actorId: userId,
        action: 'ADMIN_PERMISSIONS_UPDATED',
        targetType: 'PERMISSIONS',
        targetId: workspaceId,
        metadata: {
          previousPermissions: current,
          updatedPermissions: updated,
        },
        ipAddress: reqMeta?.ipAddress,
        userAgent: reqMeta?.userAgent,
      });
    });

    return updated;
  }

  /**
   * Soft-delete workspace with 30-day recovery deadline (Owner only).
   * Personal workspaces are permanently protected from deletion.
   * Cancels/revokes pending transfers and invitations transactionally.
   */
  async deleteWorkspace(
    workspaceId: string,
    userId: string,
    confirmationName: string,
    reqMeta?: { ipAddress?: string; userAgent?: string }
  ): Promise<{ success: boolean; message: string; deletionScheduledAt: Date }> {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!ws) throw new AppError('Workspace not found', 404);
    if (ws.deletedAt) throw new AppError('Workspace is already scheduled for deletion', 400);

    if (ws.isPersonal) {
      throw new AppError(
        'Personal workspaces cannot be deleted to preserve core user workspace invariants.',
        400
      );
    }

    if (ws.ownerId !== userId) {
      throw new AppError('Only the workspace owner can schedule workspace deletion', 403);
    }

    if (!confirmationName || confirmationName.trim().toLowerCase() !== ws.name.trim().toLowerCase()) {
      throw new AppError('Confirmation name does not match workspace name', 400);
    }

    const deletedAt = new Date();
    const deletionScheduledAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      // Acquire pessimistic row lock
      await tx.$executeRaw`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE;`;

      const currentWs = await tx.workspace.findUnique({
        where: { id: workspaceId },
      });

      if (!currentWs) throw new AppError('Workspace not found', 404);
      if (currentWs.deletedAt) throw new AppError('Workspace is already scheduled for deletion', 400);

      // 1. Soft delete the workspace
      await tx.workspace.update({
        where: { id: workspaceId },
        data: {
          deletedAt,
          deletedById: userId,
          deletionScheduledAt,
        },
      });

      // 2. Transactionally cancel pending project transfers referencing this workspace
      await tx.projectTransfer.updateMany({
        where: {
          status: 'PENDING',
          OR: [
            { sourceWorkspaceId: workspaceId },
            { destinationWorkspaceId: workspaceId },
          ],
        },
        data: {
          status: 'CANCELLED',
        },
      });

      // 3. Transactionally cancel pending ownership transfers
      await tx.workspaceOwnershipTransfer.updateMany({
        where: {
          workspaceId,
          status: 'PENDING',
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: deletedAt,
        },
      });

      // 4. Transactionally revoke pending workspace invitations
      await tx.workspaceInvitation.updateMany({
        where: {
          workspaceId,
          status: 'PENDING',
        },
        data: {
          status: 'REVOKED',
          revokedAt: deletedAt,
        },
      });

      // 5. Append audit event
      await workspaceAuditService.logAuditEvent(tx, {
        workspaceId,
        actorId: userId,
        action: 'WORKSPACE_DELETION_SCHEDULED',
        targetType: 'WORKSPACE',
        targetId: workspaceId,
        metadata: {
          deletedAt,
          deletionScheduledAt,
        },
        ipAddress: reqMeta?.ipAddress,
        userAgent: reqMeta?.userAgent,
      });
    }, { timeout: 30000 });

    // Safe post-commit cache invalidation
    try {
      await Promise.allSettled([
        cacheService.delPattern(`*ws:${workspaceId}:*`),
        cacheService.invalidateUser(userId),
        cacheService.del(`user:${userId}:workspaces`),
      ]);
    } catch (cacheErr) {
      console.warn(`[Workspace Deletion] Cache invalidation warning for workspace ${workspaceId}:`, cacheErr);
    }

    return {
      success: true,
      message: 'Workspace scheduled for deletion. It can be restored within 30 days.',
      deletionScheduledAt,
    };
  }

  /**
   * Restore a soft-deleted workspace within the 30-day window (Owner only).
   */
  async recoverWorkspace(
    workspaceId: string,
    userId: string,
    reqMeta?: { ipAddress?: string; userAgent?: string }
  ): Promise<{ success: boolean; message: string }> {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!ws) throw new AppError('Workspace not found', 404);

    if (!ws.deletedAt) {
      throw new AppError('This workspace is not deleted', 400);
    }

    // Owner authorization
    if (ws.ownerId !== userId && ws.deletedById !== userId) {
      throw new AppError('Only the workspace owner can recover this workspace', 403);
    }

    // Server-side 30-day recovery deadline enforcement
    const now = Date.now();
    const deadline = ws.deletionScheduledAt
      ? Math.min(ws.deletionScheduledAt.getTime(), ws.deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
      : ws.deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000;
    if (now > deadline) {
      throw new AppError('The 30-day recovery window for this workspace has expired and it cannot be restored.', 400);
    }

    await prisma.$transaction(async (tx) => {
      // Row lock
      await tx.$executeRaw`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE;`;

      const currentWs = await tx.workspace.findUnique({
        where: { id: workspaceId },
      });

      if (!currentWs) throw new AppError('Workspace not found', 404);
      if (!currentWs.deletedAt) throw new AppError('This workspace is not deleted', 400);

      await tx.workspace.update({
        where: { id: workspaceId },
        data: {
          deletedAt: null,
          deletedById: null,
          deletionScheduledAt: null,
        },
      });

      await workspaceAuditService.logAuditEvent(tx, {
        workspaceId,
        actorId: userId,
        action: 'WORKSPACE_RESTORED',
        targetType: 'WORKSPACE',
        targetId: workspaceId,
        metadata: {
          restoredAt: new Date(),
        },
        ipAddress: reqMeta?.ipAddress,
        userAgent: reqMeta?.userAgent,
      });
    }, { timeout: 30000 });

    // Safe post-commit cache invalidation
    try {
      await Promise.allSettled([
        cacheService.delPattern(`*ws:${workspaceId}:*`),
        cacheService.invalidateUser(userId),
        cacheService.del(`user:${userId}:workspaces`),
      ]);
    } catch (cacheErr) {
      console.warn(`[Workspace Recovery] Cache invalidation warning for workspace ${workspaceId}:`, cacheErr);
    }

    return {
      success: true,
      message: 'Workspace restored successfully',
    };
  }

  /**
   * Get all soft-deleted workspaces owned by the user that are currently within the 30-day recovery window.
   */
  async getDeletedWorkspaces(userId: string): Promise<DeletedWorkspaceDto[]> {
    const deleted = await prisma.workspace.findMany({
      where: {
        ownerId: userId,
        deletedAt: { not: null },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        ownerId: true,
        isPersonal: true,
        deletedAt: true,
        deletionScheduledAt: true,
      },
      orderBy: { deletedAt: 'desc' },
    });

    const now = Date.now();
    const result: DeletedWorkspaceDto[] = [];

    for (const w of deleted) {
      if (!w.deletedAt) continue;
      const scheduled = w.deletionScheduledAt || new Date(w.deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      const remainingMs = scheduled.getTime() - now;
      if (remainingMs > 0) {
        result.push({
          id: w.id,
          name: w.name,
          slug: w.slug,
          ownerId: w.ownerId,
          isPersonal: w.isPersonal,
          deletedAt: w.deletedAt,
          deletionScheduledAt: scheduled,
          daysRemaining: Math.ceil(remainingMs / (1000 * 60 * 60 * 24)),
        });
      }
    }

    return result;
  }
}

export const workspaceService = new WorkspaceService();
