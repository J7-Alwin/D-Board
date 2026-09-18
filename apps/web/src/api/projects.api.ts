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
  createdById: string;
  createdBy?: ProjectMemberUser;
  userRole?: 'PROJECT_ADMIN' | 'PROJECT_MEMBER';
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
  invitations?: {
    email: string;
    role?: 'PROJECT_ADMIN' | 'PROJECT_MEMBER';
    message?: string | null;
  }[];
}

export type UpdateProjectInput = Partial<CreateProjectInput>;

import { API_BASE_URL, safeParseJson } from './client';

export const projectsApi = {
  async createProject(input: CreateProjectInput): Promise<{ success: boolean; data: { project: Project } }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    return safeParseJson<{ success: boolean; data: { project: Project } }>(res, 'Failed to create project');
  },

  async getUserProjects(): Promise<{
    success: boolean;
    data: { all: Project[]; owned: Project[]; joined: Project[] };
  }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    return safeParseJson<{
      success: boolean;
      data: { all: Project[]; owned: Project[]; joined: Project[] };
    }>(res, 'Failed to fetch projects');
  },

  async getProjectById(projectId: string): Promise<{ success: boolean; data: { project: Project } }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    return safeParseJson<{ success: boolean; data: { project: Project } }>(res, 'Failed to fetch project');
  },

  async updateProject(
    projectId: string,
    input: Partial<CreateProjectInput>
  ): Promise<{ success: boolean; data: { project: Project } }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    return safeParseJson<{ success: boolean; data: { project: Project } }>(res, 'Failed to update project');
  },

  async deleteProject(projectId: string): Promise<{ success: boolean; data: { id: string; name?: string } }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    return safeParseJson<{ success: boolean; data: { id: string; name?: string } }>(res, 'Failed to delete project');
  },
};
