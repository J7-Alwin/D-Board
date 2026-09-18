import { prisma } from '../prisma.js';
import { projectService } from './project.service.js';

export class DashboardService {
  async getDashboardSummary(userId: string) {
    const { all, owned, joined } = await projectService.getUserProjects(userId);

    const now = new Date();
    const fourteenDaysLater = new Date();
    fourteenDaysLater.setDate(now.getDate() + 14);

    // Get all project IDs user is part of (owned + joined)
    const projectIds = all.map((p) => p.id);

    // Count open work items assigned to this user across all projects
    const myOpenWorkCount = await prisma.workItem.count({
      where: {
        assignedToId: userId,
        status: { not: 'COMPLETED' },
      },
    });

    // Count upcoming work item deadlines (due in next 14 days and not completed)
    const upcomingWorkDeadlinesCount = await prisma.workItem.count({
      where: {
        projectId: { in: projectIds },
        status: { not: 'COMPLETED' },
        dueDate: {
          gte: now,
          lte: fourteenDaysLater,
        },
      },
    });

    // Upcoming project deadlines
    const upcomingProjectDeadlinesCount = all.filter((p) => {
      if (!p.endDate) return false;
      const end = new Date(p.endDate);
      return end >= now && end <= fourteenDaysLater;
    }).length;

    // Fetch recent activity across user's projects
    const recentActivities = projectIds.length > 0
      ? await prisma.activity.findMany({
          where: { projectId: { in: projectIds } },
          include: {
            actor: {
              select: { id: true, fullName: true, username: true, avatarUrl: true },
            },
            workItem: {
              select: { id: true, title: true, type: true, status: true },
            },
            project: {
              select: { id: true, name: true, key: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 8,
        })
      : [];

    return {
      stats: {
        myProjectsCount: owned.length,
        joinedProjectsCount: joined.length,
        myOpenWorkCount,
        upcomingDeadlinesCount: upcomingWorkDeadlinesCount + upcomingProjectDeadlinesCount,
      },
      recentProjects: all.slice(0, 5),
      myProjects: owned.slice(0, 5),
      joinedProjects: joined.slice(0, 5),
      recentActivities,
    };
  }
}

export const dashboardService = new DashboardService();

