import { API_BASE_URL, safeParseJson } from './client';

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

export const searchApi = {
  async searchGlobal(query: string, limit = 8): Promise<{ success: boolean; data: SearchResultItem }> {
    const q = query.trim();
    if (!q) {
      return {
        success: true,
        data: { projects: [], workItems: [], notes: [], files: [] },
      };
    }
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/search?q=${encodeURIComponent(q)}&limit=${limit}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return safeParseJson<{ success: boolean; data: SearchResultItem }>(res, 'Failed to perform global search');
  },
};
