import { z } from 'zod';

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Workspace name must be at least 2 characters')
    .max(100, 'Workspace name must not exceed 100 characters'),
  avatarUrl: z.union([
    z.string().url('Invalid avatar URL'),
    z.string().startsWith('data:image/'),
    z.literal(''),
  ]).optional().nullable(),
  maxMembers: z.number().int().min(1, 'Member limit must be at least 1').nullable().optional(),
  isPersonal: z.boolean().optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Workspace name must be at least 2 characters')
    .max(100, 'Workspace name must not exceed 100 characters')
    .optional(),
  avatarUrl: z.union([
    z.string().url('Invalid avatar URL'),
    z.string().startsWith('data:image/'),
    z.literal(''),
  ]).optional().nullable(),
  maxMembers: z.number().int().min(1, 'Member limit must be at least 1').nullable().optional(),
  autoIncludeAdminsInNewProjects: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field to update must be provided',
});

export const workspaceQuerySchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace ID format').optional(),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

/**
 * Granular Workspace permission schemas for Workspace Admin, Project Admin, and Workspace Member.
 */
export const workspaceAdminPermissionsSchema = z.object({
  canInviteMembers: z.boolean().default(true),
  canRemoveMembers: z.boolean().default(false),
  canCreateProjects: z.boolean().default(true),
  canManageRoles: z.boolean().default(false),
  canDirectlyCompleteProject: z.boolean().default(true),
  canArchiveProjects: z.boolean().default(true),
  canManagePermissions: z.boolean().default(false),
  autoIncludeAdminsInNewProjects: z.boolean().default(false),
});

export const projectAdminPermissionsSchema = z.object({
  canCreateProjects: z.boolean().default(false),
  canRequestProjectCompletion: z.boolean().default(true),
});

export const workspaceMemberPermissionsSchema = z.object({
  canCreateProjects: z.boolean().default(false),
});

export interface LegacyAdminPermissions {
  canInviteMembers: boolean;
  canRemoveMembers: boolean;
  canCreateProjects: boolean;
  canManageRoles: boolean;
}

export interface WorkspaceFullPermissions extends LegacyAdminPermissions {
  canDirectlyCompleteProject: boolean;
  canArchiveProjects: boolean;
  canManagePermissions: boolean;
  autoIncludeAdminsInNewProjects: boolean;
  workspaceAdmin: z.infer<typeof workspaceAdminPermissionsSchema>;
  projectAdmin: z.infer<typeof projectAdminPermissionsSchema>;
  workspaceMember: z.infer<typeof workspaceMemberPermissionsSchema>;
}

export type WorkspaceAdminPermissions = LegacyAdminPermissions & Partial<WorkspaceFullPermissions>;

export const updateWorkspaceAdminPermissionsSchema = z.object({
  canInviteMembers: z.boolean().optional(),
  canRemoveMembers: z.boolean().optional(),
  canCreateProjects: z.boolean().optional(),
  canManageRoles: z.boolean().optional(),
  canDirectlyCompleteProject: z.boolean().optional(),
  canArchiveProjects: z.boolean().optional(),
  canManagePermissions: z.boolean().optional(),
  autoIncludeAdminsInNewProjects: z.boolean().optional(),
  workspaceAdmin: z.object({
    canInviteMembers: z.boolean().optional(),
    canRemoveMembers: z.boolean().optional(),
    canCreateProjects: z.boolean().optional(),
    canManageRoles: z.boolean().optional(),
    canDirectlyCompleteProject: z.boolean().optional(),
    canArchiveProjects: z.boolean().optional(),
    canManagePermissions: z.boolean().optional(),
    autoIncludeAdminsInNewProjects: z.boolean().optional(),
  }).optional(),
  projectAdmin: z.object({
    canCreateProjects: z.boolean().optional(),
    canRequestProjectCompletion: z.boolean().optional(),
  }).optional(),
  workspaceMember: z.object({
    canCreateProjects: z.boolean().optional(),
  }).optional(),
}).passthrough().refine((data) => Object.keys(data).length > 0, {
  message: 'At least one permission flag must be provided',
});

export type UpdateWorkspaceAdminPermissionsInput = z.infer<typeof updateWorkspaceAdminPermissionsSchema>;

export const DEFAULT_ADMIN_PERMISSIONS: LegacyAdminPermissions = {
  canInviteMembers: true,
  canRemoveMembers: false,
  canCreateProjects: true,
  canManageRoles: false,
};

export const PERSONAL_WORKSPACE_ADMIN_PERMISSIONS: LegacyAdminPermissions = {
  canInviteMembers: false,
  canRemoveMembers: false,
  canCreateProjects: false,
  canManageRoles: false,
};

export const DEFAULT_FULL_WORKSPACE_PERMISSIONS: WorkspaceFullPermissions = {
  canInviteMembers: true,
  canRemoveMembers: false,
  canCreateProjects: true,
  canManageRoles: false,
  canDirectlyCompleteProject: true,
  canArchiveProjects: true,
  canManagePermissions: false,
  autoIncludeAdminsInNewProjects: false,
  workspaceAdmin: {
    canInviteMembers: true,
    canRemoveMembers: false,
    canCreateProjects: true,
    canManageRoles: false,
    canDirectlyCompleteProject: true,
    canArchiveProjects: true,
    canManagePermissions: false,
    autoIncludeAdminsInNewProjects: false,
  },
  projectAdmin: {
    canCreateProjects: false,
    canRequestProjectCompletion: true,
  },
  workspaceMember: {
    canCreateProjects: false,
  },
};

export const PERSONAL_FULL_WORKSPACE_PERMISSIONS: WorkspaceFullPermissions = {
  canInviteMembers: false,
  canRemoveMembers: false,
  canCreateProjects: false,
  canManageRoles: false,
  canDirectlyCompleteProject: false,
  canArchiveProjects: false,
  canManagePermissions: false,
  autoIncludeAdminsInNewProjects: false,
  workspaceAdmin: {
    canInviteMembers: false,
    canRemoveMembers: false,
    canCreateProjects: false,
    canManageRoles: false,
    canDirectlyCompleteProject: false,
    canArchiveProjects: false,
    canManagePermissions: false,
    autoIncludeAdminsInNewProjects: false,
  },
  projectAdmin: {
    canCreateProjects: false,
    canRequestProjectCompletion: false,
  },
  workspaceMember: {
    canCreateProjects: false,
  },
};

/**
 * Resolves full workspace admin & member permissions.
 */
export function resolveFullWorkspacePermissions(workspace: {
  isPersonal: boolean;
  adminPermissions?: unknown;
}): WorkspaceFullPermissions {
  if (workspace.isPersonal) {
    return PERSONAL_FULL_WORKSPACE_PERMISSIONS;
  }
  if (!workspace.adminPermissions || typeof workspace.adminPermissions !== 'object') {
    return DEFAULT_FULL_WORKSPACE_PERMISSIONS;
  }

  const raw = workspace.adminPermissions as any;
  const rawWsAdmin = raw.workspaceAdmin || raw;

  const wsAdmin = {
    canInviteMembers: typeof rawWsAdmin.canInviteMembers === 'boolean' ? rawWsAdmin.canInviteMembers : (typeof raw.canInviteMembers === 'boolean' ? raw.canInviteMembers : true),
    canRemoveMembers: typeof rawWsAdmin.canRemoveMembers === 'boolean' ? rawWsAdmin.canRemoveMembers : (typeof raw.canRemoveMembers === 'boolean' ? raw.canRemoveMembers : false),
    canCreateProjects: typeof rawWsAdmin.canCreateProjects === 'boolean' ? rawWsAdmin.canCreateProjects : (typeof raw.canCreateProjects === 'boolean' ? raw.canCreateProjects : true),
    canManageRoles: typeof rawWsAdmin.canManageRoles === 'boolean' ? rawWsAdmin.canManageRoles : (typeof raw.canManageRoles === 'boolean' ? raw.canManageRoles : false),
    canDirectlyCompleteProject: typeof rawWsAdmin.canDirectlyCompleteProject === 'boolean' ? rawWsAdmin.canDirectlyCompleteProject : (typeof raw.canDirectlyCompleteProject === 'boolean' ? raw.canDirectlyCompleteProject : true),
    canArchiveProjects: typeof rawWsAdmin.canArchiveProjects === 'boolean' ? rawWsAdmin.canArchiveProjects : (typeof raw.canArchiveProjects === 'boolean' ? raw.canArchiveProjects : true),
    canManagePermissions: typeof rawWsAdmin.canManagePermissions === 'boolean' ? rawWsAdmin.canManagePermissions : (typeof raw.canManagePermissions === 'boolean' ? raw.canManagePermissions : false),
    autoIncludeAdminsInNewProjects: typeof rawWsAdmin.autoIncludeAdminsInNewProjects === 'boolean' ? rawWsAdmin.autoIncludeAdminsInNewProjects : (typeof raw.autoIncludeAdminsInNewProjects === 'boolean' ? raw.autoIncludeAdminsInNewProjects : false),
  };

  const rawProjAdmin = raw.projectAdmin || {};
  const projAdmin = {
    canCreateProjects: typeof rawProjAdmin.canCreateProjects === 'boolean' ? rawProjAdmin.canCreateProjects : false,
    canRequestProjectCompletion: typeof rawProjAdmin.canRequestProjectCompletion === 'boolean' ? rawProjAdmin.canRequestProjectCompletion : true,
  };

  const rawWsMember = raw.workspaceMember || {};
  const wsMember = {
    canCreateProjects: typeof rawWsMember.canCreateProjects === 'boolean' ? rawWsMember.canCreateProjects : false,
  };

  return {
    ...wsAdmin,
    autoIncludeAdminsInNewProjects: wsAdmin.autoIncludeAdminsInNewProjects,
    workspaceAdmin: wsAdmin,
    projectAdmin: projAdmin,
    workspaceMember: wsMember,
  };
}

/**
 * Resolves effective workspace admin permissions safely.
 * Returns legacy 4-key object when raw object has only legacy keys or null, ensuring backward compatibility.
 */
export function resolveAdminPermissions(workspace: {
  isPersonal: boolean;
  adminPermissions?: unknown;
}): WorkspaceAdminPermissions {
  if (workspace.isPersonal) {
    return PERSONAL_WORKSPACE_ADMIN_PERMISSIONS;
  }
  if (!workspace.adminPermissions || typeof workspace.adminPermissions !== 'object') {
    return DEFAULT_ADMIN_PERMISSIONS;
  }

  const raw = workspace.adminPermissions as any;
  const hasGranular = 'workspaceAdmin' in raw || 'canDirectlyCompleteProject' in raw || 'canArchiveProjects' in raw || 'canManagePermissions' in raw || 'projectAdmin' in raw || 'workspaceMember' in raw;

  if (hasGranular) {
    return resolveFullWorkspacePermissions(workspace);
  }

  return {
    canInviteMembers: typeof raw.canInviteMembers === 'boolean' ? raw.canInviteMembers : true,
    canRemoveMembers: typeof raw.canRemoveMembers === 'boolean' ? raw.canRemoveMembers : false,
    canCreateProjects: typeof raw.canCreateProjects === 'boolean' ? raw.canCreateProjects : true,
    canManageRoles: typeof raw.canManageRoles === 'boolean' ? raw.canManageRoles : false,
  };
}

/**
 * Workspace invitation payload validation.
 * Invitations can be issued for WORKSPACE_ADMIN, PROJECT_ADMIN, or WORKSPACE_MEMBER (never OWNER).
 */
export const createWorkspaceInvitationSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  role: z.enum(['WORKSPACE_ADMIN', 'PROJECT_ADMIN', 'WORKSPACE_MEMBER']).default('WORKSPACE_MEMBER'),
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
