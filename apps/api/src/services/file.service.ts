import { prisma } from '../prisma.js';
import { AppError } from '../middlewares/error.middleware.js';
import { storageService } from '../storage/storage.service.js';
import { classifyFile, sanitizeFilename, type FileCategory } from '../utils/fileClassifier.js';
import { activityService } from './activity.service.js';
import { publishToProject } from '../realtime/realtime.service.js';
import type { FileQueryParams } from '../schemas/file.schema.js';

export interface UploadedFilePayload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export const MAX_USER_STORAGE_BYTES = 200 * 1024 * 1024; // 200 MB limit per user

export class FileService {
  /**
   * Helper to verify project membership and determine admin status.
   */
  private async getMembershipAndProject(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, createdById: true },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    const isOwner = project.createdById === userId;
    const isMember = !!membership || isOwner;

    if (!isMember) {
      throw new AppError('You are not authorized to access this project files', 403);
    }

    const isAdmin = isOwner || membership?.role === 'PROJECT_ADMIN';

    return { project, membership, isAdmin };
  }

  /**
   * Upload multiple files with storage abstraction and transactional database metadata.
   */
  async uploadFiles(
    projectId: string,
    userId: string,
    files: UploadedFilePayload[],
    options?: { workItemId?: string | null; noteId?: string | null } | string | null
  ) {
    await this.getMembershipAndProject(projectId, userId);

    if (!files || files.length === 0) {
      throw new AppError('No files were provided for upload', 400);
    }

    // Check user's 200 MB storage limit
    const batchSizeBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);
    const currentStorageAgg = await prisma.attachment.aggregate({
      where: { uploadedById: userId, deletedAt: null },
      _sum: { sizeBytes: true },
    });
    const currentUsedBytes = currentStorageAgg._sum.sizeBytes || 0;
    if (currentUsedBytes + batchSizeBytes > MAX_USER_STORAGE_BYTES) {
      const usedMB = (currentUsedBytes / (1024 * 1024)).toFixed(1);
      const incomingMB = (batchSizeBytes / (1024 * 1024)).toFixed(1);
      throw new AppError(
        `Storage limit exceeded. You are using ${usedMB} MB of your 200 MB limit. Uploading ${incomingMB} MB exceeds your total quota.`,
        400
      );
    }

    const workItemId = typeof options === 'string' ? options : options?.workItemId || null;
    const noteId = typeof options === 'object' ? options?.noteId || null : null;

    // If workItemId is supplied, verify it belongs to this project
    if (workItemId) {
      const workItem = await prisma.workItem.findFirst({
        where: { id: workItemId, projectId },
      });
      if (!workItem) {
        throw new AppError('WorkItem does not belong to this project', 400);
      }
    }

    // If noteId is supplied, verify it belongs to this project
    if (noteId) {
      const note = await prisma.note.findFirst({
        where: { id: noteId, projectId },
      });
      if (!note) {
        throw new AppError('Note does not belong to this project', 400);
      }
    }

    const uploadedStorageKeys: string[] = [];
    const attachmentsToCreate: any[] = [];

    try {
      // 1. Upload binary streams to storage
      for (const file of files) {
        const cleanName = sanitizeFilename(file.originalname);
        const { storageKey, extension } = storageService.generateStorageKey(projectId, cleanName);
        const { category } = classifyFile(cleanName, file.mimetype);
        const checksum = storageService.computeChecksum(file.buffer);

        await storageService.upload(storageKey, file.buffer, file.mimetype || 'application/octet-stream');
        uploadedStorageKeys.push(storageKey);

        attachmentsToCreate.push({
          projectId,
          uploadedById: userId,
          workItemId: workItemId || null,
          noteId: noteId || null,
          originalName: cleanName,
          storageKey,
          mimeType: file.mimetype || 'application/octet-stream',
          sizeBytes: file.size,
          extension,
          category,
          checksum,
        });
      }

      // 2. Persist metadata and activities in database transaction
      const createdAttachments = await prisma.$transaction(async (tx) => {
        const results = [];
        for (const meta of attachmentsToCreate) {
          const attachment = await tx.attachment.create({
            data: meta,
            include: {
              uploadedBy: {
                select: { id: true, fullName: true, username: true, avatarUrl: true },
              },
              project: {
                select: { id: true, name: true, key: true },
              },
              workItem: {
                select: { id: true, title: true, type: true, status: true },
              },
              note: {
                select: { id: true, title: true, visibility: true, createdById: true },
              },
            },
          });

          await activityService.createActivity(
            {
              projectId,
              actorId: userId,
              type: 'FILE_UPLOADED',
              attachmentId: attachment.id,
              metadata: {
                filename: attachment.originalName,
                sizeBytes: attachment.sizeBytes,
                category: attachment.category,
              },
            },
            tx
          );

          results.push(attachment);
        }
        return results;
      });

      for (const att of createdAttachments) {
        publishToProject(projectId, 'FILE_UPLOADED', {
          projectId,
          fileId: att.id,
          originalName: att.originalName,
          category: att.category,
          sizeBytes: att.sizeBytes,
          workItemId: att.workItemId,
          noteId: (att as any).noteId,
          actorId: userId,
          actorName: att.uploadedBy?.fullName || att.uploadedBy?.username || null,
        });
      }

      return createdAttachments;
    } catch (err: any) {
      // Clean up any uploaded storage objects if metadata persistence fails (prevent orphans)
      for (const key of uploadedStorageKeys) {
        await storageService.delete(key).catch(() => {});
      }
      throw err;
    }
  }

  /**
   * Helper to construct Prisma visibility filter for files:
   * 1. Direct uploads: accessible in project
   * 2. WorkItem attachments: visible ONLY to work item creator, current assignee, or file uploader
   * 3. Note attachments: visible to all members if TEAM visibility, or ONLY to note creator and mentioned users if private
   */
  private getFileVisibilityFilter(userId: string) {
    return {
      deletedAt: null,
      OR: [
        {
          workItemId: null,
          noteId: null,
        },
        {
          workItemId: { not: null },
          workItem: {
            OR: [
              { createdById: userId },
              { assignedToId: userId },
            ],
          },
        },
        {
          noteId: { not: null },
          note: {
            OR: [
              { visibility: 'TEAM' },
              { createdById: userId },
              {
                mentions: {
                  some: { userId },
                },
              },
            ],
          },
        },
      ],
    };
  }

  /**
   * Get project files with search, filtering, and pagination.
   */
  async getProjectFiles(projectId: string, userId: string, params: FileQueryParams) {
    await this.getMembershipAndProject(projectId, userId);

    const visibilityClause = this.getFileVisibilityFilter(userId);

    const where: any = {
      projectId,
      ...visibilityClause,
    };

    if (params.category && params.category !== 'ALL') {
      where.category = params.category as FileCategory;
    }

    if (params.workItemId) {
      where.workItemId = params.workItemId;
    }

    if (params.noteId) {
      where.noteId = params.noteId;
    }

    if (params.search && params.search.trim()) {
      const search = params.search.trim();
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { originalName: { contains: search, mode: 'insensitive' } },
            { extension: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const orderBy: any = {};
    const sortBy = params.sortBy || 'createdAt';
    const sortOrder = params.sortOrder || 'desc';
    orderBy[sortBy] = sortOrder;

    const [files, total] = await Promise.all([
      prisma.attachment.findMany({
        where,
        include: {
          uploadedBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          project: {
            select: { id: true, name: true, key: true, avatarUrl: true },
          },
          workItem: {
            select: { id: true, title: true, type: true, status: true, createdById: true, assignedToId: true },
          },
          note: {
            select: {
              id: true,
              title: true,
              visibility: true,
              createdById: true,
              mentions: { select: { userId: true } },
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.attachment.count({ where }),
    ]);

    return {
      files,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Global cross-project files aggregator across all accessible projects.
   */
  async getGlobalFiles(userId: string, params: FileQueryParams) {
    const [memberships, ownedProjects] = await Promise.all([
      prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true },
      }),
      prisma.project.findMany({
        where: { createdById: userId },
        select: { id: true },
      }),
    ]);

    const accessibleProjectIds = Array.from(
      new Set([
        ...memberships.map((m) => m.projectId),
        ...ownedProjects.map((p) => p.id),
      ])
    );

    if (accessibleProjectIds.length === 0) {
      return {
        files: [],
        pagination: { total: 0, page: 1, limit: params.limit || 20, totalPages: 1 },
      };
    }

    let targetProjectIds = accessibleProjectIds;
    if (params.projectId) {
      if (!accessibleProjectIds.includes(params.projectId)) {
        throw new AppError('You are not authorized to view this project files', 403);
      }
      targetProjectIds = [params.projectId];
    }

    const visibilityClause = this.getFileVisibilityFilter(userId);

    const where: any = {
      projectId: { in: targetProjectIds },
      ...visibilityClause,
    };

    if (params.category && params.category !== 'ALL') {
      where.category = params.category as FileCategory;
    }

    if (params.workItemId) {
      where.workItemId = params.workItemId;
    }

    if (params.noteId) {
      where.noteId = params.noteId;
    }

    if (params.search && params.search.trim()) {
      const search = params.search.trim();
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { originalName: { contains: search, mode: 'insensitive' } },
            { extension: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const orderBy: any = {};
    const sortBy = params.sortBy || 'createdAt';
    const sortOrder = params.sortOrder || 'desc';
    orderBy[sortBy] = sortOrder;

    const [files, total] = await Promise.all([
      prisma.attachment.findMany({
        where,
        include: {
          uploadedBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          project: {
            select: { id: true, name: true, key: true, avatarUrl: true },
          },
          workItem: {
            select: { id: true, title: true, type: true, status: true, createdById: true, assignedToId: true },
          },
          note: {
            select: {
              id: true,
              title: true,
              visibility: true,
              createdById: true,
              mentions: { select: { userId: true } },
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.attachment.count({ where }),
    ]);

    return {
      files,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single file metadata by ID with authorization checks.
   */
  async getFileById(projectId: string, fileId: string, userId: string) {
    const { isAdmin } = await this.getMembershipAndProject(projectId, userId);

    const file = await prisma.attachment.findFirst({
      where: { id: fileId, projectId, deletedAt: null },
      include: {
        uploadedBy: {
          select: { id: true, fullName: true, username: true, avatarUrl: true },
        },
        project: {
          select: { id: true, name: true, key: true, avatarUrl: true },
        },
        workItem: {
          select: { id: true, title: true, type: true, status: true, createdById: true, assignedToId: true },
        },
        note: {
          select: {
            id: true,
            title: true,
            visibility: true,
            createdById: true,
            mentions: { select: { userId: true } },
          },
        },
      },
    });

    if (!file) {
      throw new AppError('File not found', 404);
    }

    // Privacy rule for Work Item attachments: visible only to creator + assignee + uploader + admin
    if (file.workItem) {
      const isCreator = file.workItem.createdById === userId;
      const isAssignee = file.workItem.assignedToId === userId;
      const isUploader = file.uploadedById === userId;
      if (!isCreator && !isAssignee && !isUploader && !isAdmin) {
        throw new AppError('You do not have permission to view or download this work item attachment', 403);
      }
    }

    // Privacy rule for Note attachments:
    if (file.note) {
      const isTeamNote = file.note.visibility === 'TEAM';
      const isNoteAuthor = file.note.createdById === userId;
      const isMentioned = file.note.mentions.some((m) => m.userId === userId);
      const isUploader = file.uploadedById === userId;

      if (!isTeamNote && !isNoteAuthor && !isMentioned && !isUploader && !isAdmin) {
        throw new AppError('You do not have access to this private note file', 403);
      }
    }

    return file;
  }

  /**
   * Get file stream for in-platform viewing or download.
   */
  async getFileStream(projectId: string, fileId: string, userId: string) {
    const file = await this.getFileById(projectId, fileId, userId);
    const exists = await storageService.exists(file.storageKey);
    if (!exists) {
      throw new AppError('File storage object is missing or corrupted', 404);
    }

    const stream = await storageService.getStream(file.storageKey);
    return { file, stream };
  }

  /**
   * Get full buffer for small/medium in-platform file parsing (e.g. DOCX, XLSX, JSON, Code, ZIP).
   */
  async getFileBuffer(projectId: string, fileId: string, userId: string): Promise<{ file: any; buffer: Buffer }> {
    const file = await this.getFileById(projectId, fileId, userId);
    const exists = await storageService.exists(file.storageKey);
    if (!exists) {
      throw new AppError('File storage object is missing or corrupted', 404);
    }

    const buffer = await storageService.getBuffer(file.storageKey);
    return { file, buffer };
  }

  /**
   * Rename display filename (storageKey remains unchanged).
   */
  async renameFile(projectId: string, fileId: string, userId: string, newName: string) {
    const { isAdmin } = await this.getMembershipAndProject(projectId, userId);
    const existing = await this.getFileById(projectId, fileId, userId);

    const isAuthor = existing.uploadedById === userId;
    if (!isAdmin && !isAuthor) {
      throw new AppError('You do not have permission to rename this file', 403);
    }

    const cleanName = sanitizeFilename(newName);
    const { category, extension } = classifyFile(cleanName, existing.mimeType);

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.attachment.update({
        where: { id: fileId },
        data: {
          originalName: cleanName,
          category,
          extension,
        },
        include: {
          uploadedBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          project: {
            select: { id: true, name: true, key: true },
          },
          workItem: {
            select: { id: true, title: true, type: true, status: true },
          },
        },
      });

      await activityService.createActivity(
        {
          projectId,
          actorId: userId,
          type: 'FILE_RENAMED',
          attachmentId: fileId,
          metadata: {
            oldName: existing.originalName,
            newName: cleanName,
          },
        },
        tx
      );

      return res;
    });

    publishToProject(projectId, 'FILE_RENAMED', {
      projectId,
      fileId: updated.id,
      originalName: updated.originalName,
      category: updated.category,
      actorId: userId,
    });

    return updated;
  }

  /**
   * Delete file (both binary storage and database metadata).
   */
  async deleteFile(projectId: string, fileId: string, userId: string) {
    const { isAdmin } = await this.getMembershipAndProject(projectId, userId);
    const existing = await this.getFileById(projectId, fileId, userId);

    const isAuthor = existing.uploadedById === userId;
    if (!isAdmin && !isAuthor) {
      throw new AppError('You do not have permission to delete this file', 403);
    }

    // 1. Delete binary from storage
    await storageService.delete(existing.storageKey).catch(() => {});

    // 2. Delete database record and create activity in transaction
    await prisma.$transaction(async (tx) => {
      await tx.attachment.delete({
        where: { id: fileId },
      });

      await activityService.createActivity(
        {
          projectId,
          actorId: userId,
          type: 'FILE_DELETED',
          metadata: {
            filename: existing.originalName,
            sizeBytes: existing.sizeBytes,
          },
        },
        tx
      );
    });

    publishToProject(projectId, 'FILE_DELETED', {
      projectId,
      fileId,
      originalName: existing.originalName,
      category: existing.category,
      actorId: userId,
    });

    return { success: true, message: 'File deleted successfully' };
  }

  /**
   * Attach or detach file from a WorkItem.
   */
  async attachToWorkItem(projectId: string, fileId: string, userId: string, workItemId: string | null) {
    await this.getMembershipAndProject(projectId, userId);
    const existing = await this.getFileById(projectId, fileId, userId);

    if (workItemId) {
      const workItem = await prisma.workItem.findFirst({
        where: { id: workItemId, projectId },
      });
      if (!workItem) {
        throw new AppError('WorkItem does not belong to this project', 400);
      }
    }

    const updated = await prisma.attachment.update({
      where: { id: fileId },
      data: { workItemId },
      include: {
        uploadedBy: {
          select: { id: true, fullName: true, username: true, avatarUrl: true },
        },
        project: {
          select: { id: true, name: true, key: true },
        },
        workItem: {
          select: { id: true, title: true, type: true, status: true },
        },
      },
    });

    return updated;
  }

  /**
   * Get user storage statistics including 200 MB quota and category breakdown.
   */
  async getUserStorageStats(userId: string) {
    const [storageAgg, categoryGroups, totalFiles] = await Promise.all([
      prisma.attachment.aggregate({
        where: { uploadedById: userId, deletedAt: null },
        _sum: { sizeBytes: true },
      }),
      prisma.attachment.groupBy({
        by: ['category'],
        where: { uploadedById: userId, deletedAt: null },
        _sum: { sizeBytes: true },
        _count: { id: true },
      }),
      prisma.attachment.count({
        where: { uploadedById: userId, deletedAt: null },
      }),
    ]);

    const usedBytes = storageAgg._sum.sizeBytes || 0;
    const limitBytes = MAX_USER_STORAGE_BYTES;
    const usedPercentage = Math.min(100, Math.round((usedBytes / limitBytes) * 10000) / 100);

    const categoryBreakdown = categoryGroups.map((g) => ({
      category: g.category,
      usedBytes: g._sum.sizeBytes || 0,
      count: g._count.id,
    }));

    return {
      usedBytes,
      limitBytes,
      usedPercentage,
      totalFiles,
      categoryBreakdown,
    };
  }
}

export const fileService = new FileService();
