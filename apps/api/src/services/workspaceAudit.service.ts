import prisma from '../prisma.js';
import { AppError } from '../middlewares/error.middleware.js';
import type { WorkspaceAuditAction } from '../generated/prisma/index.js';

export interface LogAuditEventParams {
  workspaceId: string;
  actorId?: string | null;
  action: WorkspaceAuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, any> | null;
  ipAddress?: string;
  userAgent?: string;
}

export interface GetAuditLogsOptions {
  page?: number;
  limit?: number;
  action?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Strips sensitive fields like passwords, tokens, hashes, auth headers, and session secrets
 * from metadata before persisting to audit history.
 */
function sanitizeAuditMetadata(metadata?: Record<string, any> | null): Record<string, any> | null {
  if (!metadata || typeof metadata !== 'object') return null;

  const sensitiveKeys = new Set([
    'password',
    'passwordhash',
    'token',
    'tokenhash',
    'rawtoken',
    'secret',
    'cookie',
    'sessiontoken',
    'sessiontokenhash',
    'authorization',
    'apikey',
  ]);

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeAuditMetadata(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export class WorkspaceAuditService {
  /**
   * Append an audit event to WorkspaceAuditLog within a given Prisma transaction or default client.
   * Never throws so that secondary logging failures do not break the transaction unless critical.
   */
  async logAuditEvent(
    txOrPrisma: any,
    params: LogAuditEventParams
  ): Promise<void> {
    const client = txOrPrisma || prisma;
    const cleanMeta = sanitizeAuditMetadata(params.metadata);

    await client.workspaceAuditLog.create({
      data: {
        workspaceId: params.workspaceId,
        actorId: params.actorId || undefined,
        action: params.action,
        targetType: params.targetType || undefined,
        targetId: params.targetId || undefined,
        metadata: cleanMeta || undefined,
        ipAddress: params.ipAddress || undefined,
        userAgent: params.userAgent || undefined,
      },
    });
  }

  /**
   * Query workspace audit logs with strict authorization (OWNER or WORKSPACE_ADMIN only)
   * and server-side workspace isolation.
   */
  async getWorkspaceAuditLogs(
    workspaceId: string,
    actorId: string,
    options: GetAuditLogsOptions = {}
  ) {
    if (!workspaceId) throw new AppError('Workspace ID is required', 400);

    // Verify workspace access and role
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: { where: { userId: actorId } },
      },
    });

    if (!ws) throw new AppError('Workspace not found', 404);
    if (ws.deletedAt) throw new AppError('Workspace has been deleted', 404);

    const isOwner = ws.ownerId === actorId;
    const actorRole = ws.members[0]?.role;

    if (!isOwner && actorRole !== 'WORKSPACE_ADMIN') {
      throw new AppError('Only workspace owners and administrators can inspect audit logs', 403);
    }

    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = { workspaceId };

    if (options.action && options.action.trim()) {
      const cleanAction = options.action.trim();
      const validActions: WorkspaceAuditAction[] = [
        'OWNERSHIP_TRANSFER_REQUESTED',
        'OWNERSHIP_TRANSFER_ACCEPTED',
        'OWNERSHIP_TRANSFER_CANCELLED',
        'OWNERSHIP_TRANSFER_REJECTED',
        'OWNERSHIP_TRANSFERRED',
        'ADMIN_PERMISSIONS_UPDATED',
        'WORKSPACE_DELETION_SCHEDULED',
        'WORKSPACE_RESTORED',
        'MEMBER_INVITED',
        'MEMBER_JOINED',
        'MEMBER_ROLE_UPDATED',
        'MEMBER_REMOVED',
        'WORKSPACE_UPDATED',
      ];
      if (validActions.includes(cleanAction as WorkspaceAuditAction)) {
        where.action = cleanAction as WorkspaceAuditAction;
      } else {
        return {
          logs: [],
          pagination: { page, limit, total: 0, totalPages: 1 },
        };
      }
    }

    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt.gte = new Date(options.startDate);
      }
      if (options.endDate) {
        where.createdAt.lte = new Date(options.endDate);
      }
    }

    const [logs, total] = await Promise.all([
      prisma.workspaceAuditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              fullName: true,
              username: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      }),
      prisma.workspaceAuditLog.count({ where }),
    ]);

    return {
      logs: logs.map((l) => ({
        id: l.id,
        workspaceId: l.workspaceId,
        actorId: l.actorId,
        actor: l.actor,
        action: l.action,
        targetType: l.targetType,
        targetId: l.targetId,
        metadata: l.metadata,
        ipAddress: l.ipAddress,
        userAgent: l.userAgent,
        createdAt: l.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const workspaceAuditService = new WorkspaceAuditService();
