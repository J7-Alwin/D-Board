import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.middleware.js';
import { workspaceService } from '../services/workspace.service.js';
import { authService } from '../services/auth.service.js';
import type { WorkspaceRole } from '../generated/prisma/index.js';

export interface WorkspaceRequest extends AuthenticatedRequest {
  workspaceId?: string;
  workspaceRole?: WorkspaceRole;
  isWorkspaceOwner?: boolean;
}

/**
 * Resolves active workspace context from X-Workspace-Id header, query param, or body.
 * If provided, strictly validates that the caller has membership/ownership access in the database.
 * If unauthorized, immediately responds with 403 Forbidden.
 * If not provided, safely resolves to the caller's verified personal workspace to eliminate data-leak risks.
 */
export async function resolveWorkspaceContext(
  req: WorkspaceRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user?.userId) {
      return next();
    }

    const rawWorkspaceId =
      (req.headers['x-workspace-id'] as string) ||
      (req.query.workspaceId as string) ||
      (req.body?.workspaceId as string) ||
      (req.params.workspaceId as string);

    if (rawWorkspaceId && rawWorkspaceId.trim()) {
      const { workspaceId, role, isOwner } = await workspaceService.verifyWorkspaceAccess(
        rawWorkspaceId.trim(),
        req.user.userId
      );

      req.workspaceId = workspaceId;
      req.workspaceRole = role;
      req.isWorkspaceOwner = isOwner;
    } else {
      const personalWs = await authService.ensurePersonalWorkspace(req.user.userId);
      req.workspaceId = personalWs.id;
      req.workspaceRole = 'OWNER';
      req.isWorkspaceOwner = true;
    }

    next();
  } catch (err: any) {
    res.status(err.statusCode || 403).json({
      success: false,
      message: err.message || 'You are not authorized to access this workspace',
    });
  }
}

/**
 * Enforces that a valid, verified active workspace context is present on the request.
 */
export function requireWorkspace(
  req: WorkspaceRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.workspaceId) {
    res.status(400).json({
      success: false,
      message: 'Active workspace context required (pass X-Workspace-Id header or workspaceId parameter)',
    });
    return;
  }
  next();
}

/**
 * Enforces that caller is Workspace Owner.
 */
export function requireWorkspaceOwner(
  req: WorkspaceRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.isWorkspaceOwner && req.workspaceRole !== 'OWNER') {
    res.status(403).json({
      success: false,
      message: 'Only the workspace owner can perform this action',
    });
    return;
  }
  next();
}

/**
 * Enforces that caller is Workspace Owner or Workspace Admin.
 */
export function requireWorkspaceAdmin(
  req: WorkspaceRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.isWorkspaceOwner && req.workspaceRole !== 'OWNER' && req.workspaceRole !== 'WORKSPACE_ADMIN') {
    res.status(403).json({
      success: false,
      message: 'Workspace administrator privileges required',
    });
    return;
  }
  next();
}

/**
 * Enforces a specific owner-controlled admin permission flag for WORKSPACE_ADMIN.
 * Workspace OWNER always bypasses this check. Regular WORKSPACE_MEMBER is always denied.
 */
export function requireAdminPermission(permission: 'canInviteMembers' | 'canRemoveMembers' | 'canCreateProjects' | 'canManageRoles') {
  return async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.workspaceId || !req.user?.userId) {
        res.status(400).json({ success: false, message: 'Workspace context and authentication required' });
        return;
      }
      if (req.isWorkspaceOwner || req.workspaceRole === 'OWNER') {
        return next();
      }
      if (req.workspaceRole === 'WORKSPACE_ADMIN') {
        const permissions = await workspaceService.getAdminPermissions(req.workspaceId, req.user.userId);
        if (permissions[permission]) {
          return next();
        }
      }
      res.status(403).json({
        success: false,
        message: `Workspace administrator permission '${permission}' required`,
      });
    } catch (err: any) {
      res.status(err.statusCode || 403).json({
        success: false,
        message: err.message || 'Permission denied',
      });
    }
  };
}

