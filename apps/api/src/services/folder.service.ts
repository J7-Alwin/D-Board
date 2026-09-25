import { prisma } from '../prisma.js';
import { AppError } from '../middlewares/error.middleware.js';
import { activityService } from './activity.service.js';
import { publishToProject } from '../realtime/realtime.service.js';

export class FolderService {
  /**
   * Helper to verify project membership
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
      throw new AppError('You are not authorized to access this project', 403);
    }

    const isAdmin = isOwner || membership?.role === 'PROJECT_ADMIN';

    return { project, membership, isAdmin };
  }

  /**
   * Create a new folder in a project
   */
  async createFolder(projectId: string, userId: string, name: string, parentId?: string | null) {
    const { project } = await this.getMembershipAndProject(projectId, userId);

    if (project.status === 'ARCHIVED') {
      throw new AppError('Cannot create folders in an archived project', 400);
    }

    const cleanName = name ? name.trim() : '';
    if (!cleanName || cleanName.length > 100) {
      throw new AppError('Folder name must be between 1 and 100 characters', 400);
    }

    // Check parent folder if specified
    const sanitizedParentId = parentId && parentId.trim() ? parentId.trim() : null;
    if (sanitizedParentId) {
      const parentFolder = await prisma.fileFolder.findFirst({
        where: { id: sanitizedParentId, projectId },
      });
      if (!parentFolder) {
        throw new AppError('Parent folder not found in this project', 404);
      }
    }

    // Check uniqueness within the same parent in this project
    const existing = await prisma.fileFolder.findFirst({
      where: {
        projectId,
        parentId: sanitizedParentId,
        name: { equals: cleanName, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new AppError('A folder with this name already exists in this location', 400);
    }

    const folder = await prisma.fileFolder.create({
      data: {
        projectId,
        name: cleanName,
        parentId: sanitizedParentId,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: { id: true, fullName: true, username: true, avatarUrl: true },
        },
      },
    });

    publishToProject(projectId, 'FOLDER_CREATED', {
      projectId,
      folderId: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      actorId: userId,
    });

    return folder;
  }

  /**
   * Get all folders for a project
   */
  async getProjectFolders(projectId: string, userId: string) {
    await this.getMembershipAndProject(projectId, userId);

    const folders = await prisma.fileFolder.findMany({
      where: { projectId },
      include: {
        createdBy: {
          select: { id: true, fullName: true, username: true, avatarUrl: true },
        },
        _count: {
          select: {
            attachments: {
              where: { deletedAt: null },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return folders;
  }

  /**
   * Rename a folder
   */
  async renameFolder(projectId: string, folderId: string, userId: string, name: string) {
    const { project, isAdmin } = await this.getMembershipAndProject(projectId, userId);

    if (project.status === 'ARCHIVED') {
      throw new AppError('Cannot rename folders in an archived project', 400);
    }

    const cleanName = name ? name.trim() : '';
    if (!cleanName || cleanName.length > 100) {
      throw new AppError('Folder name must be between 1 and 100 characters', 400);
    }

    const existing = await prisma.fileFolder.findFirst({
      where: { id: folderId, projectId },
    });

    if (!existing) {
      throw new AppError('Folder not found', 404);
    }

    if (!isAdmin && existing.createdById !== userId) {
      throw new AppError('Only project administrators or the creator can rename this folder', 403);
    }

    // Check sibling uniqueness
    const duplicate = await prisma.fileFolder.findFirst({
      where: {
        projectId,
        parentId: existing.parentId,
        name: { equals: cleanName, mode: 'insensitive' },
        id: { not: folderId },
      },
    });

    if (duplicate) {
      throw new AppError('A folder with this name already exists in this location', 400);
    }

    const updated = await prisma.fileFolder.update({
      where: { id: folderId },
      data: { name: cleanName },
      include: {
        createdBy: {
          select: { id: true, fullName: true, username: true, avatarUrl: true },
        },
      },
    });

    publishToProject(projectId, 'FOLDER_RENAMED', {
      projectId,
      folderId: updated.id,
      name: updated.name,
      actorId: userId,
    });

    return updated;
  }

  /**
   * Delete a folder (files inside are unlinked to root, subfolders deleted)
   */
  async deleteFolder(projectId: string, folderId: string, userId: string) {
    const { project, isAdmin } = await this.getMembershipAndProject(projectId, userId);

    if (project.status === 'ARCHIVED') {
      throw new AppError('Cannot delete folders in an archived project', 400);
    }

    const existing = await prisma.fileFolder.findFirst({
      where: { id: folderId, projectId },
    });

    if (!existing) {
      throw new AppError('Folder not found', 404);
    }

    if (!isAdmin && existing.createdById !== userId) {
      throw new AppError('Only project administrators or the creator can delete this folder', 403);
    }

    // Unlink any attachments residing in this folder to root (folderId = null)
    await prisma.attachment.updateMany({
      where: { folderId, projectId },
      data: { folderId: null },
    });

    await prisma.fileFolder.delete({
      where: { id: folderId },
    });

    publishToProject(projectId, 'FOLDER_DELETED', {
      projectId,
      folderId,
      actorId: userId,
    });

    return { success: true, message: 'Folder deleted successfully' };
  }

  /**
   * Move a file into a folder or to root (folderId: null)
   */
  async moveFile(projectId: string, fileId: string, userId: string, folderId: string | null) {
    const { project } = await this.getMembershipAndProject(projectId, userId);

    if (project.status === 'ARCHIVED') {
      throw new AppError('Cannot move files in an archived project', 400);
    }

    const file = await prisma.attachment.findFirst({
      where: { id: fileId, projectId, deletedAt: null },
    });

    if (!file) {
      throw new AppError('File not found in this project', 404);
    }

    if (folderId) {
      const targetFolder = await prisma.fileFolder.findFirst({
        where: { id: folderId, projectId },
      });
      if (!targetFolder) {
        throw new AppError('Target folder not found in this project', 404);
      }
    }

    const updated = await prisma.attachment.update({
      where: { id: fileId },
      data: { folderId: folderId || null },
      include: {
        folder: {
          select: { id: true, name: true },
        },
      },
    });

    publishToProject(projectId, 'FILE_MOVED', {
      projectId,
      fileId,
      folderId: updated.folderId,
      actorId: userId,
    });

    return updated;
  }
}

export const folderService = new FolderService();
