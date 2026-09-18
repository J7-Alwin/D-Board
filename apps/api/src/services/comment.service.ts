import { prisma } from '../prisma.js';
import { CreateCommentInput, UpdateCommentInput } from '../schemas/comment.schema.js';
import { ActivityType } from '../generated/prisma/index.js';
import { AppError } from '../middlewares/error.middleware.js';
import { activityService } from './activity.service.js';
import { notificationService } from './notification.service.js';
import { publishToProject } from '../realtime/realtime.service.js';

export class CommentService {
  /**
   * Helper to verify if user has access to the project
   */
  private static async verifyAccess(userId: string, projectId: string) {
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { createdById: true },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    if (!membership && project.createdById !== userId) {
      throw new AppError('You are not authorized to access this project', 403);
    }

    const role = project.createdById === userId ? 'PROJECT_ADMIN' : membership?.role;
    return { project, role };
  }

  static async getComments(userId: string, projectId: string, workItemId: string) {
    await this.verifyAccess(userId, projectId);

    const workItem = await prisma.workItem.findFirst({
      where: { id: workItemId, projectId },
    });

    if (!workItem) {
      throw new AppError('Work item not found', 404);
    }

    const comments = await prisma.comment.findMany({
      where: { workItemId, deletedAt: null },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return comments;
  }

  static async createComment(userId: string, projectId: string, workItemId: string, input: CreateCommentInput) {
    await this.verifyAccess(userId, projectId);

    const workItem = await prisma.workItem.findFirst({
      where: { id: workItemId, projectId },
    });

    if (!workItem) {
      throw new AppError('Work item not found', 404);
    }

    const comment = await prisma.$transaction(async (tx) => {
      const createdComment = await tx.comment.create({
        data: {
          body: input.content.trim(),
          workItemId,
          authorId: userId,
        },
        include: {
          author: {
            select: {
              id: true,
              fullName: true,
              username: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      });

      // Record activity
      await activityService.createActivity(
        {
          projectId,
          actorId: userId,
          type: ActivityType.COMMENT_ADDED,
          workItemId,
          metadata: {
            workItemTitle: workItem.title,
            commentId: createdComment.id,
            preview: input.content.trim().slice(0, 100),
          },
        },
        tx
      );

      // Notify Assignee and Creator (excluding comment author)
      const recipients = new Set<string>();
      if (workItem.assignedToId && workItem.assignedToId !== userId) {
        recipients.add(workItem.assignedToId);
      }
      if (workItem.createdById && workItem.createdById !== userId) {
        recipients.add(workItem.createdById);
      }

      for (const recipientId of recipients) {
        await notificationService.createNotification(
          {
            recipientId,
            actorId: userId,
            projectId,
            workItemId: workItem.id,
            commentId: createdComment.id,
            type: 'WORK_COMMENTED',
            title: 'New comment on work item',
            message: `${createdComment.author?.fullName || createdComment.author?.username || 'Someone'} commented on "${workItem.title}"`,
            link: `/app/projects/${projectId}/board?item=${workItem.id}`,
          },
          tx
        );
      }

      return createdComment;
    });

    publishToProject(projectId, 'COMMENT_CREATED', {
      projectId,
      workItemId,
      commentId: comment.id,
      preview: input.content.trim().slice(0, 100),
      actorId: userId,
      actorName: comment.author?.fullName || comment.author?.username || null,
    });

    return comment;
  }

  static async updateComment(userId: string, projectId: string, commentId: string, input: UpdateCommentInput) {
    const { role } = await this.verifyAccess(userId, projectId);

    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { workItem: true },
    });

    if (!existingComment || existingComment.workItem.projectId !== projectId || existingComment.deletedAt) {
      throw new AppError('Comment not found', 404);
    }

    if (existingComment.authorId !== userId && role !== 'PROJECT_ADMIN') {
      throw new AppError('You are not authorized to edit this comment', 403);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const comment = await tx.comment.update({
        where: { id: commentId },
        data: {
          body: input.content.trim(),
        },
        include: {
          author: {
            select: {
              id: true,
              fullName: true,
              username: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      });

      await activityService.createActivity(
        {
          projectId,
          actorId: userId,
          type: ActivityType.COMMENT_UPDATED,
          workItemId: existingComment.workItemId,
          metadata: {
            workItemTitle: existingComment.workItem.title,
            commentId: comment.id,
          },
        },
        tx
      );

      return comment;
    });

    publishToProject(projectId, 'COMMENT_UPDATED', {
      projectId,
      workItemId: existingComment.workItemId,
      commentId: updated.id,
      preview: input.content.trim().slice(0, 100),
      actorId: userId,
    });

    return updated;
  }

  static async deleteComment(userId: string, projectId: string, commentId: string) {
    const { role } = await this.verifyAccess(userId, projectId);

    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { workItem: true },
    });

    if (!existingComment || existingComment.workItem.projectId !== projectId || existingComment.deletedAt) {
      throw new AppError('Comment not found', 404);
    }

    if (existingComment.authorId !== userId && role !== 'PROJECT_ADMIN') {
      throw new AppError('You are not authorized to delete this comment', 403);
    }

    // Soft delete comment
    await prisma.$transaction(async (tx) => {
      await tx.comment.update({
        where: { id: commentId },
        data: {
          deletedAt: new Date(),
        },
      });

      await activityService.createActivity(
        {
          projectId,
          actorId: userId,
          type: ActivityType.COMMENT_DELETED,
          workItemId: existingComment.workItemId,
          metadata: {
            workItemTitle: existingComment.workItem.title,
            commentId,
          },
        },
        tx
      );
    });

    publishToProject(projectId, 'COMMENT_DELETED', {
      projectId,
      workItemId: existingComment.workItemId,
      commentId,
      actorId: userId,
    });

    return { success: true };
  }
}

export const commentService = CommentService;
