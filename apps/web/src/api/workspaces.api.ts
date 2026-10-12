import { apiClient, type ApiResponse } from './client';

export type WorkspaceRole = 'OWNER' | 'WORKSPACE_ADMIN' | 'WORKSPACE_MEMBER';
export type WorkspaceMemberOrigin = 'DIRECT' | 'PROJECT_DERIVED';

export interface WorkspaceAdminPermissions {
  canInviteMembers: boolean;
  canRemoveMembers: boolean;
  canCreateProjects: boolean;
  canManageRoles: boolean;
}

export interface WorkspaceSummary {
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
  description?: string;
  avatarUrl?: string;
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
};
