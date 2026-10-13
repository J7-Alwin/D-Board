import type { Project } from './projects.api';

export interface DashboardStats {
  myProjectsCount: number;
  joinedProjectsCount: number;
  myOpenWorkCount: number;
  upcomingDeadlinesCount: number;
}

export interface DashboardData {
  stats: DashboardStats;
  recentProjects: Project[];
  myProjects: Project[];
  joinedProjects: Project[];
  recentActivities?: any[];
}

import { apiClient } from './client';

export const dashboardApi = {
  async getDashboard(workspaceId?: string): Promise<{ success: boolean; data: DashboardData }> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers['X-Workspace-Id'] = workspaceId;
    return apiClient<{ success: boolean; data: DashboardData }>('/dashboard', { headers });
  },
};
