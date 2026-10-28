import type { ProjectMemberUser } from './projects.api';

export interface ProjectMemberDetail {
  id: string;
  userId: string;
  role: 'PROJECT_ADMIN' | 'PROJECT_MEMBER';
  joinedAt: string;
  user: ProjectMemberUser;
  isCreator: boolean;
}

export interface ProjectMembersResponse {
  project: {
    id: string;
    name: string;
    key: string | null;
    createdById: string;
    creator?: ProjectMemberUser;
  };
  members: ProjectMemberDetail[];
  pendingInvitations: {
    id: string;
    invitedEmail: string;
    role: 'PROJECT_ADMIN' | 'PROJECT_MEMBER';
    status: string;
    message: string | null;
    expiresAt: string;
    createdAt: string;
    invitedBy: {
      id: string;
      fullName: string | null;
      username: string;
    };
  }[];
  currentUserRole: 'PROJECT_ADMIN' | 'PROJECT_MEMBER';
}

export interface HandoverSummary {
  member: ProjectMemberDetail;
  isLastAdmin: boolean;
  adminCount: number;
  incompleteTasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    createdAt: string;
  }>;
  completedTasksCount: number;
  projectMembers: Array<{
    id: string;
    userId: string;
    role: 'PROJECT_ADMIN' | 'PROJECT_MEMBER';
    user: ProjectMemberUser;
  }>;
  eligibleReplacements: Array<{
    userId: string;
    workspaceRole: string;
    user: ProjectMemberUser;
    isProjectMember: boolean;
  }>;
}

export interface ExecuteHandoverPayload {
  action: 'DEMOTE' | 'REMOVE';
  replacementUserId?: string;
  reassignTasksToUserId?: string;
  note?: string;
}

import { API_BASE_URL, safeParseJson } from './client';

export const membersApi = {
  async getProjectMembers(
    projectId: string
  ): Promise<{ success: boolean; data: ProjectMembersResponse }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/members`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return safeParseJson<{ success: boolean; data: ProjectMembersResponse }>(res, 'Failed to fetch project members');
  },

  async addMember(
    projectId: string,
    payload: { userId?: string; email?: string; role?: 'PROJECT_ADMIN' | 'PROJECT_MEMBER' }
  ): Promise<{ success: boolean; message: string; data: { member: ProjectMemberDetail } }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return safeParseJson<{ success: boolean; message: string; data: { member: ProjectMemberDetail } }>(res, 'Failed to add member to project');
  },

  async updateMemberRole(
    projectId: string,
    memberId: string,
    role: 'PROJECT_ADMIN' | 'PROJECT_MEMBER'
  ): Promise<{ success: boolean; message: string; data: { member: ProjectMemberDetail } }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ role }),
    });
    return safeParseJson<{ success: boolean; message: string; data: { member: ProjectMemberDetail } }>(res, 'Failed to update member role');
  },

  async removeMember(
    projectId: string,
    memberId: string
  ): Promise<{ success: boolean; message: string }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/members/${memberId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return safeParseJson<{ success: boolean; message: string }>(res, 'Failed to remove member');
  },

  async getHandoverSummary(
    projectId: string,
    memberId: string
  ): Promise<{ success: boolean; data: HandoverSummary }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/members/${memberId}/handover-summary`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return safeParseJson<{ success: boolean; data: HandoverSummary }>(res, 'Failed to fetch handover summary');
  },

  async executeHandover(
    projectId: string,
    memberId: string,
    payload: ExecuteHandoverPayload
  ): Promise<{ success: boolean; message: string; data: any }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/members/${memberId}/handover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return safeParseJson<{ success: boolean; message: string; data: any }>(res, 'Failed to execute administrator handover');
  },
};

