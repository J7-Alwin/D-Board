import { prisma } from '../prisma.js';
import { projectService } from './project.service.js';

export class DashboardService {
  async getDashboardSummary(userId: string, workspaceId?: string) {
    const { all, owned, joined } = await projectService.getUserProjects(userId, workspaceId);

    const now = new Date();
    const fourteenDaysLater = new Date();
    fourteenDaysLater.setDate(now.getDate() + 14);

    // Get all project IDs user is part of within the active workspace
    const projectIds = all.map((p) => p.id);

    // Execute independent database queries concurrently to eliminate sequential waterfall latency
    const [
      myOpenWorkCount,
      upcomingWorkDeadlinesCount,
      overdueWorkCount,
      blockedWorkCount,
      completedWorkCount,
      totalWorkCount,
      recentActivities,
    ] = await Promise.all([
      // Count open work items assigned to this user within active workspace projects
      projectIds.length > 0
        ? prisma.workItem.count({
            where: {
              assignedToId: userId,
              status: { not: 'COMPLETED' },
              projectId: { in: projectIds },
            },
          })
        : Promise.resolve(0),

      // Count upcoming work item deadlines (due in next 14 days and not completed)
      projectIds.length > 0
        ? prisma.workItem.count({
            where: {
              projectId: { in: projectIds },
              status: { not: 'COMPLETED' },
              dueDate: {
                gte: now,
                lte: fourteenDaysLater,
              },
            },
          })
        : Promise.resolve(0),

      // Count overdue work items (not completed and dueDate in the past)
      projectIds.length > 0
        ? prisma.workItem.count({
            where: {
              projectId: { in: projectIds },
              status: { not: 'COMPLETED' },
              dueDate: { lt: now },
            },
          })
        : Promise.resolve(0),

      // Count blocked work items in workspace projects
      projectIds.length > 0
        ? prisma.workItem.count({
            where: {
              projectId: { in: projectIds },
              status: 'BLOCKED',
            },
          })
        : Promise.resolve(0),

      // Count completed work items in workspace projects
      projectIds.length > 0
        ? prisma.workItem.count({
            where: {
              projectId: { in: projectIds },
              status: 'COMPLETED',
            },
          })
        : Promise.resolve(0),

      // Total work items in workspace projects
      projectIds.length > 0
        ? prisma.workItem.count({
            where: {
              projectId: { in: projectIds },
            },
          })
        : Promise.resolve(0),

      // Fetch recent activity across user's projects
      projectIds.length > 0
        ? prisma.activity.findMany({
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
        : Promise.resolve([]),
    ]);

    // Upcoming project deadlines
    const upcomingProjectDeadlinesCount = all.filter((p) => {
      if (!p.endDate) return false;
      const end = new Date(p.endDate);
      return end >= now && end <= fourteenDaysLater;
    }).length;

    const completionRate = totalWorkCount > 0 ? Math.round((completedWorkCount / totalWorkCount) * 100) : 0;

    return {
      stats: {
        myProjectsCount: owned.length,
        joinedProjectsCount: joined.length,
        myOpenWorkCount,
        upcomingDeadlinesCount: upcomingWorkDeadlinesCount + upcomingProjectDeadlinesCount,
        overdueWorkCount,
        blockedWorkCount,
        completedWorkCount,
        totalWorkCount,
        completionRate,
      },
      recentProjects: all.slice(0, 5),
      myProjects: owned.slice(0, 5),
      joinedProjects: joined.slice(0, 5),
      recentActivities,
    };
  }
}

export const dashboardService = new DashboardService();

