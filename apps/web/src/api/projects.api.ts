export interface ProjectMemberUser {
  id: string;
  fullName: string | null;
  username: string;
  avatarUrl: string | null;
  email?: string;
}

export interface ProjectMember {
  id: string;
  userId: string;
  role: 'PROJECT_ADMIN' | 'PROJECT_MEMBER';
  joinedAt: string;
  user: ProjectMemberUser;
}

export interface Invitation {
  id: string;
  projectId: string;
  invitedEmail: string;
  invitedUserId: string | null;
  role: 'PROJECT_ADMIN' | 'PROJECT_MEMBER';
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED';
  message: string | null;
  expiresAt: string;
}

export interface Project {
  id: string;
  name: string;
  key: string | null;
  description: string;
  category: string | null;
  technologyStack: string[];
  startDate: string | null;
  endDate: string | null;
  repositoryUrl: string | null;
  liveUrl: string | null;
  avatarUrl: string | null;
  status: 'ACTIVE' | 'ARCHIVED' | 'COMPLETED';
  workspaceId?: string;
  workspace?: { id: string; name: string; slug: string; isPersonal?: boolean };
  createdById: string;
  createdBy?: ProjectMemberUser;
  userRole?: 'PROJECT_ADMIN' | 'PROJECT_MEMBER';
  visibility?: string;
  taskCount?: number;
  completedTaskCount?: number;
  progress?: number;
  memberCount?: number;
  members?: ProjectMember[];
  invitations?: Invitation[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  key?: string | null;
  description: string;
  category?: string | null;
  technologyStack?: string[];
  startDate?: string | null;
  endDate?: string | null;
  repositoryUrl?: string | null;
  liveUrl?: string | null;
  avatarUrl?: string | null;
  visibility?: 'WORKSPACE' | 'RESTRICTED' | 'Workspace' | 'Restricted';
  workspaceId?: string;
  invitations?: {
    email: string;
    role?: 'PROJECT_ADMIN' | 'PROJECT_MEMBER';
    message?: string | null;
  }[];
}

export type UpdateProjectInput = Partial<CreateProjectInput>;

import { apiClient } from './client';

export const projectsApi = {
  async createProject(input: CreateProjectInput, workspaceId?: string): Promise<{ success: boolean; data: { project: Project } }> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers['X-Workspace-Id'] = workspaceId;
    return apiClient<{ success: boolean; data: { project: Project } }>('/projects', {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
  },

  async getUserProjects(workspaceId?: string): Promise<{
    success: boolean;
    data: { all: Project[]; owned: Project[]; joined: Project[] };
  }> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers['X-Workspace-Id'] = workspaceId;
    return apiClient<{
      success: boolean;
      data: { all: Project[]; owned: Project[]; joined: Project[] };
    }>('/projects', { headers });
  },

  async getProjectById(projectId: string, workspaceId?: string): Promise<{ success: boolean; data: { project: Project } }> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers['X-Workspace-Id'] = workspaceId;
    return apiClient<{ success: boolean; data: { project: Project } }>(`/projects/${projectId}`, { headers });
  },

  async updateProject(
    projectId: string,
    input: Partial<CreateProjectInput>
  ): Promise<{ success: boolean; data: { project: Project } }> {
    return apiClient<{ success: boolean; data: { project: Project } }>(`/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  async deleteProject(projectId: string): Promise<{ success: boolean; data: { id: string; name?: string } }> {
    return apiClient<{ success: boolean; data: { id: string; name?: string } }>(`/projects/${projectId}`, {
      method: 'DELETE',
    });
  },
};
