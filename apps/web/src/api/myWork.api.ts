import type { WorkItem, WorkItemStatus, WorkItemPriority, WorkItemType } from './work.api';

export interface MyWorkSummary {
  total: number;
  createdTotal?: number;
  inProgress: number;
  dueSoon: number;
  overdue: number;
  completed: number;
}

export interface MyWorkPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface MyWorkResponse {
  workItems: WorkItem[];
  summary: MyWorkSummary;
  pagination: MyWorkPagination;
}

export interface MyWorkFilterParams {
  tab?: 'my-work' | 'created-work' | 'overdue' | 'due-soon' | 'completed' | 'all';
  status?: WorkItemStatus | string;
  priority?: WorkItemPriority | string;
  type?: WorkItemType | string;
  projectId?: string;
  search?: string;
  sort?: 'dueDate' | 'priority' | 'recentlyUpdated' | 'recentlyCreated';
  page?: number;
  limit?: number;
}

import { API_BASE_URL, safeParseJson } from './client';

export const myWorkApi = {
  async getMyWork(
    params?: MyWorkFilterParams
  ): Promise<{ success: boolean; data: MyWorkResponse }> {
    const searchParams = new URLSearchParams();
    if (params?.tab) searchParams.append('tab', params.tab);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.priority) searchParams.append('priority', params.priority);
    if (params?.type) searchParams.append('type', params.type);
    if (params?.projectId) searchParams.append('projectId', params.projectId);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.sort) searchParams.append('sort', params.sort);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());

    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/work/my${queryString}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    return safeParseJson<{ success: boolean; data: MyWorkResponse }>(res, 'Failed to fetch my work');
  },
};
