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

import { API_BASE_URL, safeParseJson } from './client';

export const invitationsApi = {
  // Project-scoped calls (Admin)
  async createInvitation(
    projectId: string,
    input: CreateInvitationInput
  ): Promise<{ success: boolean; message: string; data: { invitation: ProjectInvitation } }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/invitations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    return safeParseJson<{ success: boolean; message: string; data: { invitation: ProjectInvitation } }>(res, 'Failed to send invitation');
  },

  async getProjectInvitations(
    projectId: string
  ): Promise<{ success: boolean; data: { invitations: ProjectInvitation[] } }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/invitations`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return safeParseJson<{ success: boolean; data: { invitations: ProjectInvitation[] } }>(res, 'Failed to fetch invitations');
  },

  async resendInvitation(
    projectId: string,
    invitationId: string
  ): Promise<{ success: boolean; message: string; data: { invitation: ProjectInvitation } }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/invitations/${invitationId}/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return safeParseJson<{ success: boolean; message: string; data: { invitation: ProjectInvitation } }>(res, 'Failed to resend invitation');
  },

  async cancelInvitation(
    projectId: string,
    invitationId: string
  ): Promise<{ success: boolean; message: string }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/invitations/${invitationId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return safeParseJson<{ success: boolean; message: string }>(res, 'Failed to cancel invitation');
  },

  // User-scoped calls
  async getUserInvitations(
    status?: string
  ): Promise<{ success: boolean; data: { invitations: ProjectInvitation[] } }> {
    const query = status && status !== 'ALL' ? `?status=${status}` : '';
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/invitations${query}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return safeParseJson<{ success: boolean; data: { invitations: ProjectInvitation[] } }>(res, 'Failed to fetch user invitations');
  },

  async getPendingCount(): Promise<{ success: boolean; data: { count: number } }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/invitations/count`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return safeParseJson<{ success: boolean; data: { count: number } }>(res, 'Failed to fetch pending count');
  },

  async acceptInvitation(
    invitationId: string
  ): Promise<{ success: boolean; message: string; data: any }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/invitations/${invitationId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return safeParseJson<{ success: boolean; message: string; data: any }>(res, 'Failed to accept invitation');
  },

  async declineInvitation(
    invitationId: string
  ): Promise<{ success: boolean; message: string }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/invitations/${invitationId}/decline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return safeParseJson<{ success: boolean; message: string }>(res, 'Failed to decline invitation');
  },
};
