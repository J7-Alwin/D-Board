import path from 'path';
import { prisma } from '../prisma.js';
import { AppError } from '../middlewares/error.middleware.js';
import { storageService } from '../storage/storage.service.js';
import { classifyFile, sanitizeFilename, readHeaderBytes, type FileCategory } from '../utils/fileClassifier.js';
import { activityService } from './activity.service.js';
import { publishToProject } from '../realtime/realtime.service.js';
import { enqueueCleanupJob } from '../jobs/queues.js';
import type { FileQueryParams } from '../schemas/file.schema.js';

export interface UploadedFilePayload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  path?: string;
}

export const MAX_USER_STORAGE_BYTES = 200 * 1024 * 1024; // 200 MB limit per user

/**
 * Strips raw physical storage keys from API DTOs to protect internal object storage paths.
 */
export function sanitizeAttachmentDto<T extends Record<string, any>>(att: T): T {
  if (!att) return att;
  const copy = { ...att } as Record<string, any>;
  delete copy.storageKey;
  if (copy.storedObject) {
    const soCopy = { ...copy.storedObject };
    delete soCopy.storageKey;
    copy.storedObject = soCopy;
  }
  return copy as T;
}

export class FileService {
  /**
   * Helper to verify project membership and determine admin status.
   */
  private async getMembershipAndProject(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, createdById: true, status: true },
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
    options?: { workItemId?: string | null; noteId?: string | null; folderId?: string | null } | string | null
  ) {
    const { project } = await this.getMembershipAndProject(projectId, userId);

    if (project.status === 'ARCHIVED') {
      throw new AppError('Cannot upload files to an archived project', 400);
    }

    if (!files || files.length === 0) {
      throw new AppError('No files were provided for upload', 400);
    }

    const opts = typeof options === 'object' && options !== null ? options : {};
    const sanitizedFolderId = (opts as any).folderId || null;
    if (sanitizedFolderId) {
      const folder = await prisma.fileFolder.findFirst({
        where: { id: sanitizedFolderId, projectId },
      });
      if (!folder) {
        throw new AppError('Target folder not found in this project', 404);
      }
    }

    const batchSizeBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);

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
      // 1. Process files sequentially: stream hash computation, magic-byte inspection, and stream upload
      for (const file of files) {
        const cleanName = sanitizeFilename(file.originalname);
        const { extension } = storageService.generateStorageKey(projectId, cleanName);

        // Content / Magic byte inspection (Item 14)
        let headerBytes: Buffer | undefined;
        if (file.path) {
          headerBytes = await readHeaderBytes(file.path).catch(() => undefined);
        } else if (file.buffer) {
          headerBytes = file.buffer.subarray(0, 512);
        }

        const { category } = classifyFile(cleanName, file.mimetype, headerBytes);

        // Stream SHA-256 hash calculation (Item 3)
        let contentHash: string;
        if (file.path) {
          contentHash = await storageService.computeFileChecksum(file.path);
        } else if (file.buffer) {
          contentHash = storageService.computeChecksum(file.buffer);
        } else {
          contentHash = storageService.computeChecksum(Buffer.alloc(0));
        }

        // Project-scoped deduplication lookup
        let storedObject = await prisma.storedObject.findUnique({
          where: {
            projectId_contentHash: {
              projectId,
              contentHash,
            },
          },
        });

        let storageKey: string;
        let isNewPhysicalObject = false;

        if (storedObject) {
          // Re-use existing physical S3 object (same project + same content hash)
          storageKey = storedObject.storageKey;
        } else {
          // New physical S3 object needed for this project
          const generated = storageService.generateStorageKey(projectId, cleanName);
          storageKey = generated.storageKey;

          if (file.path) {
            await storageService.uploadFile(storageKey, file.path, file.mimetype || 'application/octet-stream');
          } else if (file.buffer) {
            await storageService.upload(storageKey, file.buffer, file.mimetype || 'application/octet-stream');
          }

          uploadedStorageKeys.push(storageKey);
          isNewPhysicalObject = true;
        }

        attachmentsToCreate.push({
          projectId,
          uploadedById: userId,
          workItemId: workItemId || null,
          noteId: noteId || null,
          folderId: sanitizedFolderId,
          originalName: cleanName,
          storageKey,
          mimeType: file.mimetype || 'application/octet-stream',
          sizeBytes: file.size,
          extension,
          category,
          checksum: contentHash,
          contentHash,
          isNewPhysicalObject,
          existingStoredObjectId: storedObject?.id || null,
        });
      }

      // 2. Persist in database with transactional row/advisory locking (Quota & Dedup Race Safety)
      const createdAttachments = await prisma.$transaction(async (tx) => {
        // Advisory lock on user storage quota to serialize concurrent uploads (Item 17)
        await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext('user_quota_' || $1));`, userId);

        const currentStorageAgg = await tx.attachment.aggregate({
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

        // Ensure StoredObject records exist (handling concurrent dedup races safely)
        for (const item of attachmentsToCreate) {
          if (!item.existingStoredObjectId) {
            try {
              const newStoredObj = await tx.storedObject.create({
                data: {
                  projectId,
                  contentHash: item.contentHash,
                  storageKey: item.storageKey,
                  mimeType: item.mimeType,
                  sizeBytes: item.sizeBytes,
                },
              });
              item.existingStoredObjectId = newStoredObj.id;
            } catch (raceErr: any) {
              if (raceErr.code === 'P2002') {
                const winner = await tx.storedObject.findUniqueOrThrow({
                  where: {
                    projectId_contentHash: {
                      projectId,
                      contentHash: item.contentHash,
                    },
                  },
                });
                item.existingStoredObjectId = winner.id;
                // Delete redundant physical S3 object asynchronously
                storageService.delete(item.storageKey).catch(() => {});
                item.storageKey = winner.storageKey;
              } else {
                throw raceErr;
              }
            }
          }
        }

        const results = [];
        for (const item of attachmentsToCreate) {
          const attachment = await tx.attachment.create({
            data: {
              projectId: item.projectId,
              uploadedById: item.uploadedById,
              workItemId: item.workItemId,
              noteId: item.noteId,
              folderId: item.folderId,
              originalName: item.originalName,
              storageKey: item.storageKey,
              mimeType: item.mimeType,
              sizeBytes: item.sizeBytes,
              extension: item.extension,
              category: item.category,
              checksum: item.checksum,
              storedObjectId: item.existingStoredObjectId,
            },
            include: {
              uploadedBy: {
                select: { id: true, fullName: true, username: true, avatarUrl: true },
              },
              project: {
                select: { id: true, name: true, key: true },
              },
              folder: {
                select: { id: true, name: true },
              },
              workItem: {
                select: { id: true, title: true, type: true, status: true },
              },
              note: {
                select: { id: true, title: true, visibility: true, createdById: true },
              },
              storedObject: true,
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

      // API DTO Security (Item 21): Strip raw storageKey from response
      return createdAttachments.map(sanitizeAttachmentDto);
    } catch (err: any) {
      // Clean up any uploaded storage objects if metadata persistence fails (prevent orphans)
      for (const key of uploadedStorageKeys) {
        await storageService.delete(key).catch((cleanupErr) => {
          console.warn(`[FileService] Failed immediate cleanup of ${key}, enqueuing orphan cleanup:`, cleanupErr);
          enqueueCleanupJob({
            type: 'ORPHAN_STORAGE_CLEANUP',
            storageKey: key,
          }).catch(() => {});
        });
      }
      throw err;
    }
  }

  /**
   * Helper to construct Prisma visibility filter for files:
   * 1. Direct uploads: accessible in project
   * 2. WorkItem attachments: visible to work item creator, current assignee, file uploader, or admin
   * 3. Note attachments: visible to all members if TEAM visibility, or note creator, mentioned users, uploader, or admin
   */
  private getFileVisibilityFilter(userId: string, isAdmin: boolean = false) {
    if (isAdmin) {
      return { deletedAt: null };
    }

    return {
      deletedAt: null,
      OR: [
        {
          uploadedById: userId,
        },
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
    const { isAdmin } = await this.getMembershipAndProject(projectId, userId);

    const visibilityClause = this.getFileVisibilityFilter(userId, isAdmin);

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
      files: files.map(sanitizeAttachmentDto),
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
      files: files.map(sanitizeAttachmentDto),
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
  async getFileById(projectId: string, fileId: string, userId: string, sanitize: boolean = true) {
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
        storedObject: true,
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

    return sanitize ? sanitizeAttachmentDto(file) : file;
  }

  /**
   * Get file stream for in-platform viewing or download.
   */
  async getFileStream(projectId: string, fileId: string, userId: string) {
    const file = await this.getFileById(projectId, fileId, userId, false);
    // Authoritative physical S3 storage key from StoredObject
    const physicalKey = file.storedObject ? file.storedObject.storageKey : file.storageKey;
    const exists = await storageService.exists(physicalKey);
    if (!exists) {
      throw new AppError('File storage object is missing or corrupted', 404);
    }

    const stream = await storageService.getStream(physicalKey);
    return { file, stream };
  }

  /**
   * Get full buffer for small/medium in-platform file parsing (e.g. DOCX, XLSX, JSON, Code, ZIP).
   */
  async getFileBuffer(projectId: string, fileId: string, userId: string): Promise<{ file: any; buffer: Buffer }> {
    const file = await this.getFileById(projectId, fileId, userId, false);
    // Authoritative physical S3 storage key from StoredObject
    const physicalKey = file.storedObject ? file.storedObject.storageKey : file.storageKey;
    const exists = await storageService.exists(physicalKey);
    if (!exists) {
      throw new AppError('File storage object is missing or corrupted', 404);
    }

    const buffer = await storageService.getBuffer(physicalKey);
    return { file, buffer };
  }

  /**
   * Rename display filename (storageKey remains unchanged).
   * Item 14: Preserves canonical detected content category.
   */
  async renameFile(projectId: string, fileId: string, userId: string, newName: string) {
    const { isAdmin, project } = await this.getMembershipAndProject(projectId, userId);

    if (project.status === 'ARCHIVED') {
      throw new AppError('Cannot rename files in an archived project', 400);
    }

    const existing = await this.getFileById(projectId, fileId, userId, false);

    const isAuthor = existing.uploadedById === userId;
    if (!isAdmin && !isAuthor) {
      throw new AppError('You do not have permission to rename this file', 403);
    }

    const cleanName = sanitizeFilename(newName);
    const rawExt = path.extname(cleanName).toLowerCase().replace(/^\./, '');
    const extension = rawExt || existing.extension;
    // Item 14: Rename operation changes display filename only. Preserve canonical detected content category!
    const category = existing.category;

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

    return sanitizeAttachmentDto(updated);
  }

  /**
   * Delete file with race-free transactional reference checking.
   * Item 4: Guarantees no physical object is deleted while committed references exist.
   */
  async deleteFile(projectId: string, fileId: string, userId: string) {
    const { isAdmin, project } = await this.getMembershipAndProject(projectId, userId);

    if (project.status === 'ARCHIVED') {
      throw new AppError('Cannot delete files in an archived project', 400);
    }

    const existing = await this.getFileById(projectId, fileId, userId, false);

    const isAuthor = existing.uploadedById === userId;
    if (!isAdmin && !isAuthor) {
      throw new AppError('You do not have permission to delete this file', 403);
    }

    let shouldDeletePhysicalStorage = false;
    const storageKeyToDelete = existing.storageKey;
    const storedObjectId = existing.storedObjectId;

    // 1. Transactional check and deletion with advisory locking (Item 4)
    await prisma.$transaction(async (tx) => {
      if (storedObjectId) {
        await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext('stored_obj_' || $1));`, storedObjectId);
      } else {
        await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext('storage_key_' || $1));`, storageKeyToDelete);
      }

      let remainingReferences = 0;
      if (storedObjectId) {
        remainingReferences = await tx.attachment.count({
          where: {
            storedObjectId,
            id: { not: fileId },
            deletedAt: null,
          },
        });
      } else {
        remainingReferences = await tx.attachment.count({
          where: {
            storageKey: storageKeyToDelete,
            id: { not: fileId },
            deletedAt: null,
          },
        });
      }

      if (remainingReferences === 0) {
        shouldDeletePhysicalStorage = true;
      }

      await tx.attachment.delete({
        where: { id: fileId },
      });

      if (shouldDeletePhysicalStorage && storedObjectId) {
        try {
          await tx.storedObject.delete({
            where: { id: storedObjectId },
          });
        } catch {
          shouldDeletePhysicalStorage = false;
        }
      }

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

    // 2. Physical storage deletion happens ONLY after the DB invariant proves zero references committed
    if (shouldDeletePhysicalStorage) {
      try {
        await storageService.delete(storageKeyToDelete);
      } catch (storageErr) {
        console.warn(`[FileService] Storage delete failed for ${storageKeyToDelete}, enqueuing BullMQ cleanup:`, storageErr);
        await enqueueCleanupJob({
          type: 'ORPHAN_STORAGE_CLEANUP',
          storageKey: storageKeyToDelete,
        }).catch((qErr) => console.error('[FileService] Failed to enqueue orphan storage cleanup job:', qErr));
      }
    }

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
    const existing = await this.getFileById(projectId, fileId, userId, false);

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

    return sanitizeAttachmentDto(updated);
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
