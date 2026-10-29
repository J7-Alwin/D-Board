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

export interface WorkItemAssignee {
  id: string;
  workItemId?: string;
  userId: string;
  user: UserSummary;
  hasStarted?: boolean;
  startedAt?: string | null;
  hasCompleted?: boolean;
  completedAt?: string | null;
  totalDurationSeconds?: number;
  lastSessionStartedAt?: string | null;
  isPaused?: boolean;
  lastCheckInCycle?: number;
  lastCheckInAt?: string | null;
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
  assignees?: WorkItemAssignee[];
  dueDate: string | null;
  todoDueDate?: string | null;
  inProgressDueDate?: string | null;
  inReviewDueDate?: string | null;
  completedDueDate?: string | null;
  rejectionReason?: string | null;
  rejectedAt?: string | null;
  rejectedById?: string | null;
  approvedAt?: string | null;
  approvedById?: string | null;
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
  progress?: number;
}

export interface CreateWorkItemInput {
  title: string;
  description?: string | null;
  type?: WorkItemType;
  status?: WorkItemStatus;
  priority?: WorkItemPriority;
  assignedToId?: string | null;
  assigneeIds?: string[];
  dueDate?: string | null;
  todoDueDate?: string | null;
  inProgressDueDate?: string | null;
  inReviewDueDate?: string | null;
  completedDueDate?: string | null;
}

export interface UpdateWorkItemInput {
  title?: string;
  description?: string | null;
  type?: WorkItemType;
  status?: WorkItemStatus;
  priority?: WorkItemPriority;
  assignedToId?: string | null;
  assigneeIds?: string[];
  dueDate?: string | null;
  todoDueDate?: string | null;
  inProgressDueDate?: string | null;
  inReviewDueDate?: string | null;
  completedDueDate?: string | null;
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

  async startTask(
    projectId: string,
    workItemId: string,
    startPaused?: boolean
  ): Promise<{ success: boolean; message: string; data: { workItem: WorkItem } }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/work/${workItemId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ startPaused: Boolean(startPaused) }),
    });

    return safeParseJson<{ success: boolean; message: string; data: { workItem: WorkItem } }>(res, 'Failed to start task');
  },

  async pauseTimer(
    projectId: string,
    workItemId: string,
    pausedAt?: string
  ): Promise<{ success: boolean; message: string; data: { workItem: WorkItem } }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/work/${workItemId}/pause-timer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ pausedAt }),
    });

    return safeParseJson<{ success: boolean; message: string; data: { workItem: WorkItem } }>(res, 'Failed to pause timer');
  },

  async checkInTimer(
    projectId: string,
    workItemId: string
  ): Promise<{ success: boolean; message: string; data: { workItem: WorkItem } }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/work/${workItemId}/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    return safeParseJson<{ success: boolean; message: string; data: { workItem: WorkItem } }>(res, 'Failed to check in timer');
  },

  async resumeTimer(
    projectId: string,
    workItemId: string
  ): Promise<{ success: boolean; message: string; data: { workItem: WorkItem } }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/work/${workItemId}/resume-timer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    return safeParseJson<{ success: boolean; message: string; data: { workItem: WorkItem } }>(res, 'Failed to resume timer');
  },

  async completeWork(
    projectId: string,
    workItemId: string
  ): Promise<{ success: boolean; message: string; data: { workItem: WorkItem } }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/work/${workItemId}/complete-work`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    return safeParseJson<{ success: boolean; message: string; data: { workItem: WorkItem } }>(res, 'Failed to mark work as complete');
  },

  async reviewTask(
    projectId: string,
    workItemId: string,
    input: { action: 'APPROVE' | 'REJECT'; reason?: string }
  ): Promise<{ success: boolean; message: string; data: { workItem: WorkItem } }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/work/${workItemId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    return safeParseJson<{ success: boolean; message: string; data: { workItem: WorkItem } }>(res, 'Failed to review task');
  },
};

