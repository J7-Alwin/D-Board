import type { UserSummary } from './work.api';

export interface ActivityItem {
  id: string;
  projectId: string;
  project?: {
    id: string;
    name: string;
    key: string;
  };
  actorId: string;
  actor: UserSummary;
  workItemId?: string | null;
  workItem?: {
    id: string;
    title: string;
    type: string;
    status: string;
    priority?: string;
  } | null;
  type: string;
  metadata?: any;
  createdAt: string;
}

export interface ActivityResponse {
  activities: ActivityItem[];
  total: number;
  limit: number;
  offset: number;
}

import { apiClient } from './client';

export const activityApi = {
  async getProjectActivities(
    projectId: string,
    params?: { category?: string; limit?: number; offset?: number },
    workspaceId?: string
  ): Promise<{ success: boolean; data: ActivityResponse }> {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.append('category', params.category);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());

    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const headers: Record<string, string> = {};
    if (workspaceId) headers['X-Workspace-Id'] = workspaceId;
    return apiClient<{ success: boolean; data: ActivityResponse }>(`/projects/${projectId}/activity${queryString}`, { headers });
  },

  async getGlobalActivities(
    params?: { category?: string; limit?: number; offset?: number },
    workspaceId?: string
  ): Promise<{ success: boolean; data: ActivityResponse }> {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.append('category', params.category);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());

    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const headers: Record<string, string> = {};
    if (workspaceId) headers['X-Workspace-Id'] = workspaceId;
    return apiClient<{ success: boolean; data: ActivityResponse }>(`/activities${queryString}`, { headers });
  },
};
