import { z } from 'zod';

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Workspace name must be at least 2 characters')
    .max(100, 'Workspace name must not exceed 100 characters'),
  avatarUrl: z.string().url('Invalid avatar URL').optional().nullable(),
  maxMembers: z.number().int().min(1, 'Member limit must be at least 1').nullable().optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Workspace name must be at least 2 characters')
    .max(100, 'Workspace name must not exceed 100 characters')
    .optional(),
  avatarUrl: z.string().url('Invalid avatar URL').optional().nullable(),
  maxMembers: z.number().int().min(1, 'Member limit must be at least 1').nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field to update must be provided',
});

export const workspaceQuerySchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace ID format').optional(),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

/**
 * Owner-controlled Admin permission configuration schema and defaults.
 * Personal workspaces cannot delegate authority (all flags always false).
 */
export const workspaceAdminPermissionsSchema = z.object({
  canInviteMembers: z.boolean().default(true),
  canRemoveMembers: z.boolean().default(false),
  canCreateProjects: z.boolean().default(true),
  canManageRoles: z.boolean().default(false),
});

export const updateWorkspaceAdminPermissionsSchema = z.object({
  canInviteMembers: z.boolean().optional(),
  canRemoveMembers: z.boolean().optional(),
  canCreateProjects: z.boolean().optional(),
  canManageRoles: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one permission flag must be provided',
});

export type WorkspaceAdminPermissions = z.infer<typeof workspaceAdminPermissionsSchema>;
export type UpdateWorkspaceAdminPermissionsInput = z.infer<typeof updateWorkspaceAdminPermissionsSchema>;

export const DEFAULT_ADMIN_PERMISSIONS: WorkspaceAdminPermissions = {
  canInviteMembers: true,
  canRemoveMembers: false,
  canCreateProjects: true,
  canManageRoles: false,
};

export const PERSONAL_WORKSPACE_ADMIN_PERMISSIONS: WorkspaceAdminPermissions = {
  canInviteMembers: false,
  canRemoveMembers: false,
  canCreateProjects: false,
  canManageRoles: false,
};

/**
 * Resolves effective workspace admin permissions safely.
 * Personal workspaces always return all-false to guarantee owner authority cannot be delegated.
 */
export function resolveAdminPermissions(workspace: {
  isPersonal: boolean;
  adminPermissions?: unknown;
}): WorkspaceAdminPermissions {
  if (workspace.isPersonal) {
    return PERSONAL_WORKSPACE_ADMIN_PERMISSIONS;
  }
  if (!workspace.adminPermissions) {
    return DEFAULT_ADMIN_PERMISSIONS;
  }
  const parsed = workspaceAdminPermissionsSchema.safeParse(workspace.adminPermissions);
  return parsed.success ? parsed.data : DEFAULT_ADMIN_PERMISSIONS;
}

/**
 * Workspace invitation payload validation.
 * Invitations can only be issued for WORKSPACE_ADMIN or WORKSPACE_MEMBER (never OWNER).
 */
export const createWorkspaceInvitationSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  role: z.enum(['WORKSPACE_ADMIN', 'WORKSPACE_MEMBER']).default('WORKSPACE_MEMBER'),
  message: z.string().trim().max(500, 'Message cannot exceed 500 characters').optional().nullable(),
});

export type CreateWorkspaceInvitationInput = z.infer<typeof createWorkspaceInvitationSchema>;

export const requestOwnershipTransferSchema = z.object({
  targetUserId: z.string().uuid('Invalid user ID format').optional(),
  targetEmail: z.string().trim().email('Invalid email address').toLowerCase().optional(),
  targetRole: z.enum(['WORKSPACE_ADMIN', 'WORKSPACE_MEMBER']).default('WORKSPACE_ADMIN'),
}).refine((data) => !!data.targetUserId || !!data.targetEmail, {
  message: 'Either targetUserId or targetEmail must be provided',
});

export type RequestOwnershipTransferInput = z.infer<typeof requestOwnershipTransferSchema>;

export const acceptOwnershipTransferSchema = z.object({
  token: z.string().trim().min(16).optional(),
});

export type AcceptOwnershipTransferInput = z.infer<typeof acceptOwnershipTransferSchema>;

export const rejectOwnershipTransferSchema = z.object({
  token: z.string().trim().min(16).optional(),
});

export type RejectOwnershipTransferInput = z.infer<typeof rejectOwnershipTransferSchema>;

export const deleteWorkspaceSchema = z.object({
  confirmationName: z.string().trim().min(1, 'Confirmation name is required'),
});

export type DeleteWorkspaceInput = z.infer<typeof deleteWorkspaceSchema>;

export const workspaceAuditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: z.string().trim().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type WorkspaceAuditLogQueryInput = z.infer<typeof workspaceAuditLogQuerySchema>;
