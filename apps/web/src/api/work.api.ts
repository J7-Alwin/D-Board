export type WorkItemType =
  | 'TASK'
  | 'BUG'
  | 'FEATURE'
  | 'IMPROVEMENT'
  | 'RESEARCH'
  | 'DOCUMENTATION'
  | 'OTHER';

export type WorkItemStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'IN_REVIEW' | 'COMPLETED';

export type WorkItemPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface UserSummary {
  id: string;
  fullName: string | null;
  username: string;
  avatarUrl: string | null;
  email?: string;
}

export interface WorkItemComment {
  id: string;
  workItemId: string;
  authorId: string;
  author: UserSummary;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkItemActivity {
  id: string;
  projectId: string;
  actorId: string;
  actor: UserSummary;
  workItemId?: string | null;
  type: string;
  metadata?: any;
  createdAt: string;
}

export interface WorkItem {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  type: WorkItemType;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  createdById: string;
  createdBy: UserSummary;
  assignedToId: string | null;
  assignedTo: UserSummary | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  project?: {
    id: string;
    name: string;
    key: string | null;
    avatarUrl: string | null;
  };
  _count?: {
    comments: number;
  };
  comments?: WorkItemComment[];
  activities?: WorkItemActivity[];
}


export interface WorkStats {
  total: number;
  todo: number;
  inProgress: number;
  blocked: number;
  inReview: number;
  completed: number;
  overdue: number;
  completionPercentage: number;
}

export interface CreateWorkItemInput {
  title: string;
  description?: string | null;
  type?: WorkItemType;
  status?: WorkItemStatus;
  priority?: WorkItemPriority;
  assignedToId?: string | null;
  dueDate?: string | null;
}

export interface UpdateWorkItemInput {
  title?: string;
  description?: string | null;
  type?: WorkItemType;
  status?: WorkItemStatus;
  priority?: WorkItemPriority;
  assignedToId?: string | null;
  dueDate?: string | null;
}

export interface WorkFilterParams {
  status?: string;
  priority?: string;
  type?: string;
  assignedToId?: string;
  search?: string;
}

import { API_BASE_URL, safeParseJson } from './client';

export const workApi = {
  async getProjectWorkItems(
    projectId: string,
    filters?: WorkFilterParams
  ): Promise<{ success: boolean; data: { workItems: WorkItem[]; stats: WorkStats } }> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.assignedToId) params.append('assignedToId', filters.assignedToId);
    if (filters?.search) params.append('search', filters.search);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/work${queryString}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    return safeParseJson<{ success: boolean; data: { workItems: WorkItem[]; stats: WorkStats } }>(res, 'Failed to fetch work items');
  },

  async getWorkItemById(
    projectId: string,
    workItemId: string
  ): Promise<{ success: boolean; data: { workItem: WorkItem } }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/work/${workItemId}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    return safeParseJson<{ success: boolean; data: { workItem: WorkItem } }>(res, 'Failed to fetch work item');
  },

  async createWorkItem(
    projectId: string,
    input: CreateWorkItemInput
  ): Promise<{ success: boolean; message: string; data: { workItem: WorkItem } }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/work`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    return safeParseJson<{ success: boolean; message: string; data: { workItem: WorkItem } }>(res, 'Failed to create work item');
  },

  async updateWorkItem(
    projectId: string,
    workItemId: string,
    input: UpdateWorkItemInput
  ): Promise<{ success: boolean; message: string; data: { workItem: WorkItem } }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/work/${workItemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    return safeParseJson<{ success: boolean; message: string; data: { workItem: WorkItem } }>(res, 'Failed to update work item');
  },

  async deleteWorkItem(
    projectId: string,
    workItemId: string
  ): Promise<{ success: boolean; message: string }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/work/${workItemId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    return safeParseJson<{ success: boolean; message: string }>(res, 'Failed to delete work item');
  },
};
