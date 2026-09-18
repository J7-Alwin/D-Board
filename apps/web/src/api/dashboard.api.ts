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
}

import { API_BASE_URL, safeParseJson } from './client';

export const dashboardApi = {
  async getDashboard(): Promise<{ success: boolean; data: DashboardData }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/dashboard`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    return safeParseJson<{ success: boolean; data: DashboardData }>(res, 'Failed to fetch dashboard data');
  },
};
