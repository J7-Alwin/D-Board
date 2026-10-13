import type { UserSummary } from './work.api';

export interface ProjectInvitation {
  id: string;
  projectId: string;
  invitedEmail: string;
  invitedUserId: string | null;
  role: 'PROJECT_ADMIN' | 'PROJECT_MEMBER';
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED';
  message: string | null;
  expiresAt: string;
  acceptedAt?: string | null;
  declinedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  isExpired?: boolean;
  invitedBy?: UserSummary;
  invitedUser?: UserSummary | null;
  project?: {
    id: string;
    name: string;
    key: string | null;
    description: string;
    avatarUrl: string | null;
    category: string | null;
  };
}

export interface CreateInvitationInput {
  email: string;
  role?: 'PROJECT_ADMIN' | 'PROJECT_MEMBER';
  message?: string | null;
}

import { apiClient } from './client';

export const invitationsApi = {
  // Project-scoped calls (Admin)
  async createInvitation(
    projectId: string,
    input: CreateInvitationInput
  ): Promise<{ success: boolean; message: string; data: { invitation: ProjectInvitation } }> {
    return apiClient<{ success: boolean; message: string; data: { invitation: ProjectInvitation } }>(
      `/projects/${projectId}/invitations`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );
  },

  async getProjectInvitations(
    projectId: string
  ): Promise<{ success: boolean; data: { invitations: ProjectInvitation[] } }> {
    return apiClient<{ success: boolean; data: { invitations: ProjectInvitation[] } }>(
      `/projects/${projectId}/invitations`
    );
  },

  async resendInvitation(
    projectId: string,
    invitationId: string
  ): Promise<{ success: boolean; message: string; data: { invitation: ProjectInvitation } }> {
    return apiClient<{ success: boolean; message: string; data: { invitation: ProjectInvitation } }>(
      `/projects/${projectId}/invitations/${invitationId}/resend`,
      { method: 'POST' }
    );
  },

  async cancelInvitation(
    projectId: string,
    invitationId: string
  ): Promise<{ success: boolean; message: string }> {
    return apiClient<{ success: boolean; message: string }>(
      `/projects/${projectId}/invitations/${invitationId}/cancel`,
      { method: 'POST' }
    );
  },

  // User-scoped calls
  async getUserInvitations(
    status?: string,
    workspaceId?: string
  ): Promise<{ success: boolean; data: { invitations: ProjectInvitation[] } }> {
    const query = status && status !== 'ALL' ? `?status=${status}` : '';
    const headers: Record<string, string> = {};
    if (workspaceId && workspaceId !== 'all') {
      headers['X-Workspace-Id'] = workspaceId;
    } else {
      headers['X-Workspace-Id'] = 'all';
    }
    return apiClient<{ success: boolean; data: { invitations: ProjectInvitation[] } }>(
      `/invitations${query}`,
      { headers }
    );
  },

  async getPendingCount(
    workspaceId?: string
  ): Promise<{ success: boolean; data: { count: number } }> {
    const headers: Record<string, string> = {};
    if (workspaceId && workspaceId !== 'all') {
      headers['X-Workspace-Id'] = workspaceId;
    } else {
      headers['X-Workspace-Id'] = 'all';
    }
    return apiClient<{ success: boolean; data: { count: number } }>(
      '/invitations/count',
      { headers }
    );
  },

  async acceptInvitation(
    invitationId: string
  ): Promise<{ success: boolean; message: string; data: any }> {
    return apiClient<{ success: boolean; message: string; data: any }>(
      `/invitations/${invitationId}/accept`,
      { method: 'POST' }
    );
  },

  async declineInvitation(
    invitationId: string
  ): Promise<{ success: boolean; message: string }> {
    return apiClient<{ success: boolean; message: string }>(
      `/invitations/${invitationId}/decline`,
      { method: 'POST' }
    );
  },
};
