import crypto from 'node:crypto';
import prisma from '../prisma.js';
import { AppError } from '../middlewares/error.middleware.js';
import type {
  CreateWorkspaceInput,
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
  isOwner: boolean;
  userRole: WorkspaceRole;
  memberCount: number;
  projectCount: number;
  adminPermissions?: WorkspaceAdminPermissions;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: string;
    fullName: string | null;
    username: string;
    avatarUrl: string | null;
  };
}

export class WorkspaceService {
  /**
   * Get all workspaces the authenticated user has access to,
   * categorized into 'owned' (My Workspaces) and 'joined' (Team Workspaces).
   */
  async getUserWorkspaces(userId: string): Promise<{
    owned: WorkspaceSummaryDto[];
    joined: WorkspaceSummaryDto[];
  }> {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
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
        workspace: { select: { id: true, ownerId: true } },
      },
    });

    if (!member) {
      throw new AppError('You do not have access to this workspace', 403);
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
    input: UpdateWorkspaceAdminPermissionsInput
  ): Promise<WorkspaceAdminPermissions> {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!ws) throw new AppError('Workspace not found', 404);

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

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { adminPermissions: updated },
    });

    return updated;
  }
}

export const workspaceService = new WorkspaceService();
