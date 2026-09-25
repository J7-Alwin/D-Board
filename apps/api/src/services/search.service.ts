import { prisma } from '../prisma.js';

export interface SearchResult {
  projects: Array<{
    id: string;
    name: string;
    key: string | null;
    description: string | null;
    status: string;
    createdAt: Date;
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
    createdAt: Date;
  }>;
  notes: Array<{
    id: string;
    projectId: string;
    projectName: string;
    title: string;
    visibility: string;
    createdAt: Date;
  }>;
  files: Array<{
    id: string;
    projectId: string;
    projectName: string;
    originalName: string;
    extension: string;
    category: string;
    sizeBytes: number;
    createdAt: Date;
  }>;
}

export class SearchService {
  async searchGlobal(userId: string, query: string, limit = 8): Promise<SearchResult> {
    const q = query.trim();
    const emptyResult: SearchResult = {
      projects: [],
      workItems: [],
      notes: [],
      files: [],
    };

    if (q.length < 2) {
      return emptyResult;
    }

    const maxLimit = Math.min(Math.max(limit, 1), 20);

    // 1. Fetch user's accessible projects
    const userProjects = await prisma.project.findMany({
      where: {
        OR: [
          { createdById: userId },
          { members: { some: { userId } } },
        ],
      },
      select: { id: true, name: true, key: true, description: true, status: true, createdById: true, createdAt: true },
    });

    if (userProjects.length === 0) {
      return emptyResult;
    }

    const projectMap = new Map(userProjects.map((p) => [p.id, p]));
    const projectIds = userProjects.map((p) => p.id);
    const ownedProjectIds = new Set(userProjects.filter((p) => p.createdById === userId).map((p) => p.id));

    // 2. Parallel searches across accessible projects
    const [matchingProjects, matchingWorkItems, matchingFiles, matchingNotes] = await Promise.all([
      // Projects
      prisma.project.findMany({
        where: {
          id: { in: projectIds },
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { key: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          key: true,
          description: true,
          status: true,
          createdAt: true,
        },
        take: maxLimit,
      }),

      // Work Items
      prisma.workItem.findMany({
        where: {
          projectId: { in: projectIds },
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          projectId: true,
          title: true,
          type: true,
          status: true,
          priority: true,
          createdAt: true,
        },
        take: maxLimit,
      }),

      // Files
      prisma.attachment.findMany({
        where: {
          projectId: { in: projectIds },
          OR: [
            { originalName: { contains: q, mode: 'insensitive' } },
            { extension: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          projectId: true,
          originalName: true,
          extension: true,
          category: true,
          sizeBytes: true,
          createdAt: true,
        },
        take: maxLimit,
      }),

      // Notes (enforce authorization: TEAM visibility OR author OR mentioned OR owner)
      prisma.note.findMany({
        where: {
          projectId: { in: projectIds },
          AND: [
            {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { content: { contains: q, mode: 'insensitive' } },
              ],
            },
            {
              OR: [
                { visibility: 'TEAM' },
                { createdById: userId },
                { mentions: { some: { userId } } },
                { projectId: { in: Array.from(ownedProjectIds) } },
              ],
            },
          ],
        },
        select: {
          id: true,
          projectId: true,
          title: true,
          visibility: true,
          createdAt: true,
        },
        take: maxLimit,
      }),
    ]);

    return {
      projects: matchingProjects,
      workItems: matchingWorkItems.map((item) => {
        const proj = projectMap.get(item.projectId);
        return {
          ...item,
          projectName: proj?.name || 'Project',
          projectKey: proj?.key || 'TASK',
        };
      }),
      files: matchingFiles.map((file) => {
        const proj = projectMap.get(file.projectId);
        return {
          ...file,
          projectName: proj?.name || 'Project',
        };
      }),
      notes: matchingNotes.map((note) => {
        const proj = projectMap.get(note.projectId);
        return {
          ...note,
          projectName: proj?.name || 'Project',
        };
      }),
    };
  }
}

export const searchService = new SearchService();
