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

import { API_BASE_URL, safeParseJson } from './client';

export const activityApi = {
  async getProjectActivities(
    projectId: string,
    params?: { category?: string; limit?: number; offset?: number }
  ): Promise<{ success: boolean; data: ActivityResponse }> {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.append('category', params.category);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());

    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/activity${queryString}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return safeParseJson<{ success: boolean; data: ActivityResponse }>(res, 'Failed to fetch project activity');
  },

  async getGlobalActivities(
    params?: { category?: string; limit?: number; offset?: number }
  ): Promise<{ success: boolean; data: ActivityResponse }> {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.append('category', params.category);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());

    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/activities${queryString}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return safeParseJson<{ success: boolean; data: ActivityResponse }>(res, 'Failed to fetch global activities');
  },
};
