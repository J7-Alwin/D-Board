export interface SearchResultItem {
  projects: Array<{
    id: string;
    name: string;
    key: string;
    description: string | null;
    status: string;
    createdAt: string;
  }>;
  workItems: Array<{
    id: string;
    projectId: string;
    projectName: string;
    projectKey: string;
    title: string;
    type: string;
    status: string;
    priority: string;
    createdAt: string;
  }>;
  notes: Array<{
    id: string;
    projectId: string;
    projectName: string;
    title: string;
    visibility: string;
    createdAt: string;
  }>;
  files: Array<{
    id: string;
    projectId: string;
    projectName: string;
    originalName: string;
    extension: string;
    category: string;
    sizeBytes: number;
    createdAt: string;
  }>;
}

import { apiClient } from './client';

export const searchApi = {
  async searchGlobal(query: string, limit = 8, workspaceId?: string): Promise<{ success: boolean; data: SearchResultItem }> {
    const q = query.trim();
    if (!q) {
      return {
        success: true,
        data: { projects: [], workItems: [], notes: [], files: [] },
      };
    }
    const headers: Record<string, string> = {};
    if (workspaceId) headers['X-Workspace-Id'] = workspaceId;
    return apiClient<{ success: boolean; data: SearchResultItem }>(`/search?q=${encodeURIComponent(q)}&limit=${limit}`, { headers });
  },
};
