import { apiClient, type ApiResponse } from './client';

export type WorkspaceRole = 'OWNER' | 'WORKSPACE_ADMIN' | 'PROJECT_ADMIN' | 'WORKSPACE_MEMBER';
export type WorkspaceMemberOrigin = 'DIRECT' | 'PROJECT_DERIVED';

export interface WorkspaceAdminPermissions {
  canInviteMembers: boolean;
  canRemoveMembers: boolean;
  canCreateProjects: boolean;
  canManageRoles: boolean;
  canDirectlyCompleteProject?: boolean;
  canArchiveProjects?: boolean;
  canManagePermissions?: boolean;
  autoIncludeAdminsInNewProjects?: boolean;
  workspaceAdmin?: {
    canInviteMembers: boolean;
    canRemoveMembers: boolean;
    canCreateProjects: boolean;
    canManageRoles: boolean;
    canDirectlyCompleteProject: boolean;
    canArchiveProjects: boolean;
    canManagePermissions: boolean;
    autoIncludeAdminsInNewProjects?: boolean;
  };
  projectAdmin?: {
    canCreateProjects: boolean;
    canRequestProjectCompletion: boolean;
  };
  workspaceMember?: {
    canCreateProjects: boolean;
  };
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  avatarUrl: string | null;
  ownerId: string;
  isPersonal: boolean;
  isDefault?: boolean;
  isOwner: boolean;
  userRole: WorkspaceRole;
  memberCount: number;
  projectCount: number;
  maxMembers?: number | null;
  adminPermissions?: WorkspaceAdminPermissions;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    fullName: string | null;
    username: string;
    avatarUrl: string | null;
  };
}

export interface WorkspaceDetail extends WorkspaceSummary {
  members: Array<{
    id: string;
    userId: string;
    role: WorkspaceRole;
    joinedAt: string;
    user: {
      id: string;
      fullName: string | null;
      username: string;
      avatarUrl: string | null;
    };
  }>;
}

export interface WorkspaceMemberItem {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  origin: WorkspaceMemberOrigin;
  joinedAt: string;
  isOwner: boolean;
  user: {
    id: string;
    fullName: string | null;
    username: string;
    email: string;
    avatarUrl: string | null;
    isDeactivated?: boolean;
  };
}

export interface WorkspaceInvitationItem {
  id: string;
  workspaceId: string;
  invitedEmail: string;
  invitedUserId: string | null;
  role: WorkspaceRole;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'REVOKED';
  message: string | null;
  expiresAt: string;
  createdAt: string;
  isExpired?: boolean;
  invitedBy: {
    id: string;
    fullName: string | null;
    username: string;
  };
  invitedUser?: {
    id: string;
    fullName: string | null;
    username: string;
    avatarUrl: string | null;
  } | null;
}

export interface PendingWorkspaceInvitation {
  id: string;
  workspaceId: string;
  role: WorkspaceRole;
  message: string | null;
  expiresAt: string;
  createdAt: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
    avatarUrl: string | null;
    isPersonal: boolean;
    owner: {
      id: string;
      fullName: string | null;
      username: string;
      avatarUrl: string | null;
    };
  };
  invitedBy: {
    id: string;
    fullName: string | null;
    username: string;
    avatarUrl: string | null;
  };
}

export interface CreateWorkspaceInput {
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  maxMembers?: number | null;
  isPersonal?: boolean;
}

export interface UpdateWorkspaceInput {
  name?: string;
  description?: string | null;
  avatarUrl?: string | null;
  maxMembers?: number | null;
}

export interface CreateWorkspaceInvitationInput {
  email: string;
  role?: WorkspaceRole;
  message?: string;
}

export const workspacesApi = {
  /**
   * List workspaces categorized into owned (My Workspaces) and joined (Team Workspaces).
   */
  async getWorkspaces(): Promise<ApiResponse<{ owned: WorkspaceSummary[]; joined: WorkspaceSummary[] }>> {
    return apiClient('/workspaces', { method: 'GET' });
  },

  /**
   * Get workspace detail by ID.
   */
  async getWorkspaceById(id: string): Promise<ApiResponse<{ workspace: WorkspaceDetail }>> {
    return apiClient(`/workspaces/${id}`, { method: 'GET' });
  },

  /**
   * Create a new workspace where the current user will be Owner.
   */
  async createWorkspace(input: CreateWorkspaceInput): Promise<ApiResponse<{ workspace: WorkspaceDetail }>> {
    return apiClient('/workspaces', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Update workspace details and settings (Owner only for maxMembers).
   */
  async updateWorkspace(
    workspaceId: string,
    input: UpdateWorkspaceInput
  ): Promise<ApiResponse<{ workspace: WorkspaceSummary }>> {
    return apiClient(`/workspaces/${workspaceId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  /**
   * List members of a workspace.
   */
  async getMembers(
    workspaceId: string,
    params?: { page?: number; limit?: number; search?: string; role?: string }
  ): Promise<ApiResponse<{ members: WorkspaceMemberItem[]; total: number; page: number; limit: number; totalPages: number }>> {
    const q = new URLSearchParams();
    if (params?.page) q.append('page', String(params.page));
    if (params?.limit) q.append('limit', String(params.limit));
    if (params?.search) q.append('search', params.search);
    if (params?.role) q.append('role', params.role);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return apiClient(`/workspaces/${workspaceId}/members${qs}`, { method: 'GET' });
  },

  /**
   * Update a member's role in the workspace.
   */
  async updateMemberRole(
    workspaceId: string,
    memberId: string,
    role: WorkspaceRole
  ): Promise<ApiResponse<{ member: WorkspaceMemberItem }>> {
    return apiClient(`/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  /**
   * Remove a member from the workspace.
   */
  async removeMember(workspaceId: string, memberId: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return apiClient(`/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Send an invitation to join the workspace.
   */
  async createInvitation(
    workspaceId: string,
    input: CreateWorkspaceInvitationInput
  ): Promise<ApiResponse<{ invitation: WorkspaceInvitationItem }>> {
    return apiClient(`/workspaces/${workspaceId}/invitations`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * List pending/past invitations for a workspace.
   */
  async getInvitations(workspaceId: string): Promise<ApiResponse<{ invitations: WorkspaceInvitationItem[] }>> {
    return apiClient(`/workspaces/${workspaceId}/invitations`, { method: 'GET' });
  },

  /**
   * Resend a pending workspace invitation.
   */
  async resendInvitation(
    workspaceId: string,
    invitationId: string
  ): Promise<ApiResponse<{ invitation: WorkspaceInvitationItem }>> {
    return apiClient(`/workspaces/${workspaceId}/invitations/${invitationId}/resend`, {
      method: 'POST',
    });
  },

  /**
   * Revoke a pending workspace invitation.
   */
  async revokeInvitation(
    workspaceId: string,
    invitationId: string
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return apiClient(`/workspaces/${workspaceId}/invitations/${invitationId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Get pending invitations for the authenticated user across all workspaces.
   */
  async getUserPendingInvitations(): Promise<ApiResponse<{ invitations: PendingWorkspaceInvitation[] }>> {
    return apiClient('/workspaces/invitations/pending', { method: 'GET' });
  },

  /**
   * Accept an invitation using its ID or Token.
   */
  async acceptInvitation(invitationIdOrToken: string): Promise<ApiResponse<{ success: boolean; message: string; workspace: WorkspaceSummary }>> {
    return apiClient(`/workspaces/invitations/${invitationIdOrToken}/accept`, {
      method: 'POST',
    });
  },

  /**
   * Decline an invitation using its ID or Token.
   */
  async declineInvitation(invitationIdOrToken: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return apiClient(`/workspaces/invitations/${invitationIdOrToken}/decline`, {
      method: 'POST',
    });
  },

  /**
   * Get workspace Admin permissions policy.
   */
  async getAdminPermissions(workspaceId: string): Promise<ApiResponse<{ permissions: WorkspaceAdminPermissions }>> {
    return apiClient(`/workspaces/${workspaceId}/admin-permissions`, { method: 'GET' });
  },

  /**
   * Update workspace Admin permissions policy (Owner only).
   */
  async updateAdminPermissions(
    workspaceId: string,
    permissions: Partial<WorkspaceAdminPermissions>
  ): Promise<ApiResponse<{ permissions: WorkspaceAdminPermissions }>> {
    return apiClient(`/workspaces/${workspaceId}/admin-permissions`, {
      method: 'PATCH',
      body: JSON.stringify(permissions),
    });
  },

  /**
   * Update maximum member limit for a team workspace.
   */
  async updateMemberLimit(
    workspaceId: string,
    maxMembers: number | null
  ): Promise<ApiResponse<{ workspace: WorkspaceSummary }>> {
    return this.updateWorkspace(workspaceId, { maxMembers });
  },

  // =========================================================================
  // Ownership Transfer (Phase 5A)
  // =========================================================================

  async requestOwnershipTransfer(
    workspaceId: string,
    input: { targetUserId?: string; targetEmail?: string; targetRole: WorkspaceRole }
  ): Promise<ApiResponse<{ transfer: OwnershipTransferItem }>> {
    return apiClient(`/workspaces/${workspaceId}/ownership-transfer/request`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async initiateOwnershipTransfer(
    workspaceId: string,
    input: { targetUserId?: string; targetEmail?: string; targetRole: WorkspaceRole }
  ): Promise<ApiResponse<{ transfer: OwnershipTransferItem }>> {
    return this.requestOwnershipTransfer(workspaceId, input);
  },

  async getPendingOwnershipTransfer(
    workspaceId: string
  ): Promise<ApiResponse<{ transfer: OwnershipTransferItem | null }>> {
    return apiClient(`/workspaces/${workspaceId}/ownership-transfer`, { method: 'GET' });
  },

  async cancelOwnershipTransfer(
    workspaceId: string
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return apiClient(`/workspaces/${workspaceId}/ownership-transfer/cancel`, { method: 'POST' });
  },

  async rejectOwnershipTransfer(
    workspaceId: string,
    token?: string
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return apiClient(`/workspaces/${workspaceId}/ownership-transfer/reject`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  async acceptOwnershipTransfer(
    workspaceId: string,
    token?: string
  ): Promise<ApiResponse<{ success: boolean; message: string; workspaceId: string }>> {
    return apiClient(`/workspaces/${workspaceId}/ownership-transfer/accept`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  // =========================================================================
  // Soft Deletion and 30-Day Recovery (Phase 5B)
  // =========================================================================

  async deleteWorkspace(
    workspaceId: string,
    confirmationName: string
  ): Promise<ApiResponse<{ success: boolean; message: string; deletionScheduledAt: string }>> {
    return apiClient(`/workspaces/${workspaceId}/delete`, {
      method: 'POST',
      body: JSON.stringify({ confirmationName }),
    });
  },

  async recoverWorkspace(
    workspaceId: string
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return apiClient(`/workspaces/${workspaceId}/recover`, { method: 'POST' });
  },

  async getDeletedWorkspaces(): Promise<ApiResponse<{ workspaces: DeletedWorkspaceItem[] }>> {
    return apiClient('/workspaces/deleted', { method: 'GET' });
  },

  // =========================================================================
  // Audit Trail (Phase 5C)
  // =========================================================================

  async getAuditLogs(
    workspaceId: string,
    options: { page?: number; limit?: number; action?: string; startDate?: string; endDate?: string } = {}
  ): Promise<ApiResponse<{
    logs: WorkspaceAuditLogItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>> {
    const params = new URLSearchParams();
    if (options.page) params.set('page', String(options.page));
    if (options.limit) params.set('limit', String(options.limit));
    if (options.action) params.set('action', options.action);
    if (options.startDate) params.set('startDate', options.startDate);
    if (options.endDate) params.set('endDate', options.endDate);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiClient(`/workspaces/${workspaceId}/audit-logs${queryString}`, { method: 'GET' });
  },

  /**
   * Leave a workspace (Non-owners only).
   */
  async leaveWorkspace(workspaceId: string): Promise<ApiResponse<void>> {
    return apiClient(`/workspaces/${workspaceId}/leave`, {
      method: 'POST',
    });
  },

  /**
   * Reset / clear all projects and data in workspace (Owner only).
   */
  async clearWorkspaceData(workspaceId: string): Promise<ApiResponse<{ clearedProjectCount: number }>> {
    return apiClient(`/workspaces/${workspaceId}/clear-data`, {
      method: 'POST',
    });
  },

  /**
   * Reset / clear all projects and data in personal workspace.
   */
  async clearPersonalWorkspaceData(workspaceId: string): Promise<ApiResponse<{ clearedProjectCount: number }>> {
    return this.clearWorkspaceData(workspaceId);
  },

  /**
   * Workspace Admin requests deletion of team workspace.
   */
  async requestWorkspaceDeletion(workspaceId: string, reason?: string): Promise<ApiResponse<{ deletionRequest: WorkspaceDeletionRequestItem }>> {
    return apiClient(`/workspaces/${workspaceId}/deletion-request`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  /**
   * Fetch current deletion request status.
   */
  async getWorkspaceDeletionRequest(workspaceId: string): Promise<ApiResponse<{ deletionRequest: WorkspaceDeletionRequestItem | null }>> {
    return apiClient(`/workspaces/${workspaceId}/deletion-request`, {
      method: 'GET',
    });
  },

  /**
   * Owner declines deletion request.
   */
  async declineWorkspaceDeletionRequest(workspaceId: string, reason?: string): Promise<ApiResponse<void>> {
    return apiClient(`/workspaces/${workspaceId}/deletion-request/decline`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  /**
   * Requester or Owner cancels deletion request.
   */
  async cancelWorkspaceDeletionRequest(workspaceId: string): Promise<ApiResponse<void>> {
    return apiClient(`/workspaces/${workspaceId}/deletion-request`, {
      method: 'DELETE',
    });
  },
};

export interface WorkspaceDeletionRequestItem {
  id: string;
  requestedById: string;
  requestedByName: string;
  requestedByEmail: string;
  requestedByAvatar: string | null;
  reason?: string | null;
  requestedAt: string;
  status: 'PENDING' | 'DECLINED' | 'APPROVED';
}

export type WorkspaceOwnershipTransferStatus = 'PENDING' | 'ACCEPTED' | 'CANCELLED' | 'REJECTED' | 'EXPIRED';

export interface OwnershipTransferItem {
  id: string;
  workspaceId: string;
  sourceOwnerId: string;
  targetUserId: string;
  targetEmail?: string;
  targetRole: WorkspaceRole;
  status: WorkspaceOwnershipTransferStatus;
  expiresAt: string;
  createdAt: string;
  sourceOwner: {
    id: string;
    fullName: string | null;
    username: string;
    email: string;
    avatarUrl: string | null;
  };
  targetUser: {
    id: string;
    fullName: string | null;
    username: string;
    email: string;
    avatarUrl: string | null;
  };
}

export interface DeletedWorkspaceItem {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  isPersonal: boolean;
  deletedAt: string;
  deletionScheduledAt: string;
  daysRemaining: number;
}

export interface WorkspaceAuditLogItem {
  id: string;
  workspaceId: string;
  actorId: string | null;
  actor: {
    id: string;
    fullName: string | null;
    username: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  targetUser?: {
    id: string;
    fullName: string | null;
    username: string;
    email?: string;
  } | null;
  targetEmail?: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, any> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}
