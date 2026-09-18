import { prisma } from '../prisma.js';
import { AppError } from '../middlewares/error.middleware.js';
import { parseMentions } from '../utils/noteMention.util.js';
import { activityService } from './activity.service.js';
import { notificationService } from './notification.service.js';
import { publishToProject, publishToUsers } from '../realtime/realtime.service.js';
import type { CreateNoteInput, UpdateNoteInput, NoteQueryParams } from '../schemas/note.schema.js';

export class NoteService {
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
      throw new AppError('You are not a member of this project', 403);
    }

    const isAdmin = isOwner || membership?.role === 'PROJECT_ADMIN';

    return { project, membership, isAdmin };
  }

  /**
   * Resolve mentions and validate that mentioned users belong to the project.
   */
  private async resolveMentions(projectId: string, content: string) {
    const { hasTeamMention, usernames } = parseMentions(content);

    // Rule: @team wins over specific @usernames
    if (hasTeamMention) {
      return {
        visibility: 'TEAM' as const,
        mentionedUserIds: [] as string[],
      };
    }

    if (usernames.length === 0) {
      return {
        visibility: 'TEAM' as const,
        mentionedUserIds: [] as string[],
      };
    }

    // Look up project members with matching usernames
    const members = await prisma.projectMember.findMany({
      where: {
        projectId,
        user: {
          username: {
            in: usernames,
            mode: 'insensitive',
          },
        },
      },
      include: {
        user: {
          select: { id: true, username: true },
        },
      },
    });

    // Also check project owner in case they don't have an explicit projectMember row
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        createdById: true,
        createdBy: {
          select: { id: true, username: true },
        },
      },
    });

    const foundUsernameMap = new Map<string, string>(); // lowercase username -> userId
    for (const m of members) {
      foundUsernameMap.set(m.user.username.toLowerCase(), m.user.id);
    }
    if (project?.createdBy) {
      foundUsernameMap.set(project.createdBy.username.toLowerCase(), project.createdBy.id);
    }

    // Validate every mentioned username
    for (const u of usernames) {
      if (!foundUsernameMap.has(u.toLowerCase())) {
        throw new AppError(`User @${u} does not belong to this project.`, 400);
      }
    }

    const mentionedUserIds = Array.from(new Set(Array.from(foundUsernameMap.values())));

    return {
      visibility: 'USERS' as const,
      mentionedUserIds,
    };
  }

  /**
   * List notes for a project enforcing database-level visibility.
   */
  async getProjectNotes(projectId: string, userId: string, params: NoteQueryParams) {
    const { isAdmin } = await this.getMembershipAndProject(projectId, userId);

    const where: any = {
      projectId,
    };

    // Text search on title and content
    if (params.search && params.search.trim()) {
      const searchTerm = params.search.trim();
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { content: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    if (params.pinned !== undefined) {
      where.pinned = params.pinned;
    }

    if (params.authorId) {
      where.createdById = params.authorId;
    }

    if (params.tag && params.tag.trim()) {
      where.tags = { has: params.tag.trim() };
    }

    if (params.color && params.color.trim()) {
      where.color = params.color.trim();
    }

    // Visibility filter construction
    if (isAdmin) {
      if (params.visibility === 'TEAM') {
        where.visibility = 'TEAM';
      } else if (params.visibility === 'USERS') {
        where.visibility = 'USERS';
      }
    } else {
      // Regular project member: must only see TEAM notes, authored notes, or mentioned notes
      const userVisibilityCondition = [
        { visibility: 'TEAM' },
        { createdById: userId },
        { mentions: { some: { userId } } },
      ];

      if (params.visibility === 'TEAM') {
        where.visibility = 'TEAM';
      } else if (params.visibility === 'USERS') {
        where.visibility = 'USERS';
        where.AND = [
          ...(where.AND || []),
          {
            OR: [
              { createdById: userId },
              { mentions: { some: { userId } } },
            ],
          },
        ];
      } else {
        // ALL visible notes
        where.AND = [
          ...(where.AND || []),
          { OR: userVisibilityCondition },
        ];
      }
    }

    // Ordering
    let orderBy: any = [{ pinned: 'desc' }];
    if (params.sort === 'recentCreated') {
      orderBy.push({ createdAt: 'desc' });
    } else if (params.sort === 'title') {
      orderBy.push({ title: 'asc' });
    } else {
      orderBy.push({ updatedAt: 'desc' });
    }

    const [notes, total] = await Promise.all([
      prisma.note.findMany({
        where,
        include: {
          createdBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          updatedBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          mentions: {
            include: {
              user: {
                select: { id: true, fullName: true, username: true, avatarUrl: true },
              },
            },
          },
          project: {
            select: { id: true, name: true, key: true, avatarUrl: true },
          },
          attachments: {
            where: { deletedAt: null },
            include: {
              uploadedBy: {
                select: { id: true, fullName: true, username: true, avatarUrl: true },
              },
            },
          },
        },
        orderBy,
        take: params.limit,
        skip: params.offset,
      }),
      prisma.note.count({ where }),
    ]);

    return {
      notes: notes.map((note) => this.formatNoteDto(note, userId, isAdmin)),
      total,
      limit: params.limit,
      offset: params.offset,
    };
  }

  /**
   * List global notes across all projects the user is a member of.
   */
  async getGlobalNotes(userId: string, params: NoteQueryParams & { projectId?: string }) {
    // Find all projects accessible by user
    const [memberships, ownedProjects] = await Promise.all([
      prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true, role: true },
      }),
      prisma.project.findMany({
        where: { createdById: userId },
        select: { id: true },
      }),
    ]);

    const adminProjectIds = new Set<string>();
    const memberProjectIds = new Set<string>();

    for (const op of ownedProjects) {
      adminProjectIds.add(op.id);
    }
    for (const m of memberships) {
      if (m.role === 'PROJECT_ADMIN') {
        adminProjectIds.add(m.projectId);
      } else {
        memberProjectIds.add(m.projectId);
      }
    }

    const allAccessibleProjectIds = Array.from(
      new Set([...Array.from(adminProjectIds), ...Array.from(memberProjectIds)])
    );

    if (allAccessibleProjectIds.length === 0) {
      return { notes: [], total: 0, limit: params.limit, offset: params.offset };
    }

    // Filter down if single projectId requested
    let targetProjectIds = allAccessibleProjectIds;
    if (params.projectId) {
      if (!allAccessibleProjectIds.includes(params.projectId)) {
        throw new AppError('You are not authorized to view notes in this project', 403);
      }
      targetProjectIds = [params.projectId];
    }

    const adminTargets = targetProjectIds.filter((id) => adminProjectIds.has(id));
    const memberTargets = targetProjectIds.filter((id) => !adminProjectIds.has(id));

    // Construct project + visibility condition
    const projectConditions: any[] = [];

    if (adminTargets.length > 0) {
      const adminCond: any = { projectId: { in: adminTargets } };
      if (params.visibility === 'TEAM') adminCond.visibility = 'TEAM';
      if (params.visibility === 'USERS') adminCond.visibility = 'USERS';
      projectConditions.push(adminCond);
    }

    if (memberTargets.length > 0) {
      const memberCond: any = {
        projectId: { in: memberTargets },
      };
      if (params.visibility === 'TEAM') {
        memberCond.visibility = 'TEAM';
      } else if (params.visibility === 'USERS') {
        memberCond.visibility = 'USERS';
        memberCond.OR = [
          { createdById: userId },
          { mentions: { some: { userId } } },
        ];
      } else {
        memberCond.OR = [
          { visibility: 'TEAM' },
          { createdById: userId },
          { mentions: { some: { userId } } },
        ];
      }
      projectConditions.push(memberCond);
    }

    const where: any = {
      OR: projectConditions,
    };

    if (params.search && params.search.trim()) {
      const searchTerm = params.search.trim();
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { content: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
      ];
    }

    if (params.pinned !== undefined) {
      where.pinned = params.pinned;
    }

    if (params.authorId) {
      where.createdById = params.authorId;
    }

    if (params.tag && params.tag.trim()) {
      where.tags = { has: params.tag.trim() };
    }

    if (params.color && params.color.trim()) {
      where.color = params.color.trim();
    }

    let orderBy: any = [{ pinned: 'desc' }];
    if (params.sort === 'recentCreated') {
      orderBy.push({ createdAt: 'desc' });
    } else if (params.sort === 'title') {
      orderBy.push({ title: 'asc' });
    } else {
      orderBy.push({ updatedAt: 'desc' });
    }

    const [notes, total] = await Promise.all([
      prisma.note.findMany({
        where,
        include: {
          createdBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          updatedBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          mentions: {
            include: {
              user: {
                select: { id: true, fullName: true, username: true, avatarUrl: true },
              },
            },
          },
          project: {
            select: { id: true, name: true, key: true, avatarUrl: true },
          },
          attachments: {
            where: { deletedAt: null },
            include: {
              uploadedBy: {
                select: { id: true, fullName: true, username: true, avatarUrl: true },
              },
            },
          },
        },
        orderBy,
        take: params.limit,
        skip: params.offset,
      }),
      prisma.note.count({ where }),
    ]);

    return {
      notes: notes.map((note) => {
        const isAdmin = adminProjectIds.has(note.projectId);
        return this.formatNoteDto(note, userId, isAdmin);
      }),
      total,
      limit: params.limit,
      offset: params.offset,
    };
  }

  /**
   * Get a single note by ID with strict server-side visibility check.
   */
  async getNoteById(projectId: string, noteId: string, userId: string) {
    const { isAdmin } = await this.getMembershipAndProject(projectId, userId);

    const note = await prisma.note.findFirst({
      where: {
        id: noteId,
        projectId,
      },
      include: {
        createdBy: {
          select: { id: true, fullName: true, username: true, avatarUrl: true },
        },
        updatedBy: {
          select: { id: true, fullName: true, username: true, avatarUrl: true },
        },
        mentions: {
          include: {
            user: {
              select: { id: true, fullName: true, username: true, avatarUrl: true },
            },
          },
        },
        project: {
          select: { id: true, name: true, key: true, avatarUrl: true },
        },
        attachments: {
          where: { deletedAt: null },
          include: {
            uploadedBy: {
              select: { id: true, fullName: true, username: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!note) {
      throw new AppError('Note not found', 404);
    }

    // Check visibility permissions
    if (!isAdmin) {
      const isAuthor = note.createdById === userId;
      const isMentioned = note.mentions.some((m) => m.userId === userId);
      const isTeam = note.visibility === 'TEAM';

      if (!isTeam && !isAuthor && !isMentioned) {
        throw new AppError('You do not have permission to view this note', 403);
      }
    }

    return this.formatNoteDto(note, userId, isAdmin);
  }

  /**
   * Create a new note with automatic mention parsing and transactional visibility setting.
   */
  async createNote(projectId: string, userId: string, data: CreateNoteInput) {
    await this.getMembershipAndProject(projectId, userId);

    const { visibility, mentionedUserIds } = await this.resolveMentions(projectId, data.content);

    const note = await prisma.$transaction(async (tx) => {
      const created = await tx.note.create({
        data: {
          projectId,
          title: data.title,
          content: data.content,
          color: data.color || 'yellow',
          tags: data.tags || [],
          createdById: userId,
          visibility,
          pinned: data.pinned ?? false,
          mentions:
            mentionedUserIds.length > 0
              ? {
                  create: mentionedUserIds.map((uId) => ({
                    userId: uId,
                  })),
                }
              : undefined,
        },
        include: {
          createdBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          updatedBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          mentions: {
            include: {
              user: {
                select: { id: true, fullName: true, username: true, avatarUrl: true },
              },
            },
          },
          project: {
            select: { id: true, name: true, key: true, avatarUrl: true },
          },
          attachments: {
            where: { deletedAt: null },
            include: {
              uploadedBy: {
                select: { id: true, fullName: true, username: true, avatarUrl: true },
              },
            },
          },
        },
      });

      // Link attachments if provided
      if (data.attachmentIds && data.attachmentIds.length > 0) {
        await tx.attachment.updateMany({
          where: { id: { in: data.attachmentIds }, projectId },
          data: { noteId: created.id },
        });
      }

      // Create activity log
      await activityService.createActivity(
        {
          projectId,
          actorId: userId,
          type: 'NOTE_CREATED',
          metadata: {
            noteId: created.id,
            title: created.visibility === 'TEAM' ? created.title : undefined,
            visibility: created.visibility,
            recipientCount: mentionedUserIds.length,
          },
        },
        tx
      );

      // Targeted notifications
      if (created.visibility === 'TEAM') {
        const members = await tx.projectMember.findMany({
          where: { projectId, userId: { not: userId } },
          select: { userId: true },
        });
        const proj = await tx.project.findUnique({
          where: { id: projectId },
          select: { createdById: true },
        });

        const recipientIds = new Set(members.map((m) => m.userId));
        if (proj?.createdById && proj.createdById !== userId) {
          recipientIds.add(proj.createdById);
        }

        for (const recipientId of recipientIds) {
          await notificationService.createNotification(
            {
              recipientId,
              actorId: userId,
              projectId,
              noteId: created.id,
              type: 'NOTE_TEAM_UPDATED',
              title: 'New team note',
              message: `${created.createdBy?.fullName || created.createdBy?.username || 'Someone'} shared a note with @team: "${created.title}"`,
              link: `/app/projects/${projectId}/notes?note=${created.id}`,
            },
            tx
          );
        }
      } else {
        // Private note: notify ONLY mentioned users
        for (const recipientId of mentionedUserIds) {
          if (recipientId !== userId) {
            await notificationService.createNotification(
              {
                recipientId,
                actorId: userId,
                projectId,
                noteId: created.id,
                type: 'NOTE_MENTIONED',
                title: 'You were mentioned in a note',
                message: `${created.createdBy?.fullName || created.createdBy?.username || 'Someone'} mentioned you in a note: "${created.title}"`,
                link: `/app/projects/${projectId}/notes?note=${created.id}`,
              },
              tx
            );
          }
        }
      }

      return created;
    });

    if (note.visibility === 'TEAM') {
      publishToProject(projectId, 'NOTE_CREATED', {
        projectId,
        noteId: note.id,
        title: note.title,
        visibility: 'TEAM',
        pinned: note.pinned,
        actorId: userId,
        actorName: note.createdBy?.fullName || note.createdBy?.username || null,
      });
    } else {
      const recipientIds = Array.from(new Set([userId, ...mentionedUserIds]));
      publishToUsers(recipientIds, 'NOTE_CREATED', {
        projectId,
        noteId: note.id,
        title: note.title,
        visibility: 'USERS',
        pinned: note.pinned,
        actorId: userId,
        actorName: note.createdBy?.fullName || note.createdBy?.username || null,
      });
    }

    return this.formatNoteDto(note, userId, true);
  }

  /**
   * Update an existing note, recalculating mentions atomically if content changed.
   */
  async updateNote(projectId: string, noteId: string, userId: string, data: UpdateNoteInput) {
    const { isAdmin } = await this.getMembershipAndProject(projectId, userId);

    const existing = await prisma.note.findFirst({
      where: { id: noteId, projectId },
      include: {
        mentions: true,
      },
    });

    if (!existing) {
      throw new AppError('Note not found', 404);
    }

    // Edit permission check: Project Admin or Note Author
    const isAuthor = existing.createdById === userId;
    if (!isAdmin && !isAuthor) {
      throw new AppError('You do not have permission to edit this note', 403);
    }

    let nextVisibility = existing.visibility;
    let nextMentionedUserIds: string[] | null = null;

    if (data.content !== undefined) {
      const resolved = await this.resolveMentions(projectId, data.content);
      nextVisibility = resolved.visibility;
      nextMentionedUserIds = resolved.mentionedUserIds;
    }

    const updated = await prisma.$transaction(async (tx) => {
      // If content was updated, reset and re-create mentions
      if (nextMentionedUserIds !== null) {
        await tx.noteMention.deleteMany({
          where: { noteId },
        });

        if (nextMentionedUserIds.length > 0) {
          await tx.noteMention.createMany({
            data: nextMentionedUserIds.map((uId) => ({
              noteId,
              userId: uId,
            })),
          });
        }
      }

      const noteRes = await tx.note.update({
        where: { id: noteId },
        data: {
          title: data.title,
          content: data.content,
          color: data.color,
          tags: data.tags,
          pinned: data.pinned,
          visibility: nextVisibility,
          updatedById: userId,
        },
        include: {
          createdBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          updatedBy: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          mentions: {
            include: {
              user: {
                select: { id: true, fullName: true, username: true, avatarUrl: true },
              },
            },
          },
          project: {
            select: { id: true, name: true, key: true, avatarUrl: true },
          },
          attachments: {
            where: { deletedAt: null },
            include: {
              uploadedBy: {
                select: { id: true, fullName: true, username: true, avatarUrl: true },
              },
            },
          },
        },
      });

      // Update attachment links if provided
      if (data.attachmentIds !== undefined) {
        await tx.attachment.updateMany({
          where: { noteId },
          data: { noteId: null },
        });
        if (data.attachmentIds.length > 0) {
          await tx.attachment.updateMany({
            where: { id: { in: data.attachmentIds }, projectId },
            data: { noteId },
          });
        }
      }

      // Log activities
      if (data.pinned !== undefined && data.pinned !== existing.pinned) {
        await activityService.createActivity(
          {
            projectId,
            actorId: userId,
            type: data.pinned ? 'NOTE_PINNED' : 'NOTE_UNPINNED',
            metadata: {
              noteId,
              title: noteRes.visibility === 'TEAM' ? noteRes.title : undefined,
            },
          },
          tx
        );
      }

      if (nextVisibility !== existing.visibility) {
        await activityService.createActivity(
          {
            projectId,
            actorId: userId,
            type: 'NOTE_VISIBILITY_CHANGED',
            metadata: {
              noteId,
              from: existing.visibility,
              to: nextVisibility,
            },
          },
          tx
        );
      } else if (data.title !== undefined || data.content !== undefined) {
        await activityService.createActivity(
          {
            projectId,
            actorId: userId,
            type: 'NOTE_UPDATED',
            metadata: {
              noteId,
              title: noteRes.visibility === 'TEAM' ? noteRes.title : undefined,
            },
          },
          tx
        );
      }

      return noteRes;
    });

    const isPinnedChanged = data.pinned !== undefined && data.pinned !== existing.pinned;
    const eventType = isPinnedChanged ? (updated.pinned ? 'NOTE_PINNED' : 'NOTE_UNPINNED') : 'NOTE_UPDATED';

    if (updated.visibility === 'TEAM') {
      publishToProject(projectId, eventType, {
        projectId,
        noteId: updated.id,
        title: updated.title,
        visibility: 'TEAM',
        pinned: updated.pinned,
        actorId: userId,
      });
    } else {
      const mentionIds = updated.mentions ? updated.mentions.map((m: any) => m.userId || m.user?.id) : [];
      const recipientIds = Array.from(new Set([userId, existing.createdById, ...mentionIds]));
      publishToUsers(recipientIds, eventType, {
        projectId,
        noteId: updated.id,
        title: updated.title,
        visibility: 'USERS',
        pinned: updated.pinned,
        actorId: userId,
      });
    }

    return this.formatNoteDto(updated, userId, isAdmin);
  }

  /**
   * Delete a note.
   */
  async deleteNote(projectId: string, noteId: string, userId: string) {
    const { isAdmin } = await this.getMembershipAndProject(projectId, userId);

    const existing = await prisma.note.findFirst({
      where: { id: noteId, projectId },
      include: {
        mentions: {
          select: { userId: true },
        },
      },
    });

    if (!existing) {
      throw new AppError('Note not found', 404);
    }

    const isAuthor = existing.createdById === userId;
    if (!isAdmin && !isAuthor) {
      throw new AppError('You do not have permission to delete this note', 403);
    }

    await prisma.$transaction(async (tx) => {
      await tx.note.delete({
        where: { id: noteId },
      });

      await activityService.createActivity(
        {
          projectId,
          actorId: userId,
          type: 'NOTE_DELETED',
          metadata: {
            noteId,
            title: existing.visibility === 'TEAM' ? existing.title : undefined,
            visibility: existing.visibility,
          },
        },
        tx
      );
    });

    if (existing.visibility === 'TEAM') {
      publishToProject(projectId, 'NOTE_DELETED', {
        projectId,
        noteId,
        visibility: 'TEAM',
        actorId: userId,
      });
    } else {
      const recipientIds = Array.from(new Set([userId, existing.createdById, ...existing.mentions.map((m) => m.userId)]));
      publishToUsers(recipientIds, 'NOTE_DELETED', {
        projectId,
        noteId,
        visibility: 'USERS',
        actorId: userId,
      });
    }

    return { success: true, message: 'Note deleted successfully' };
  }

  /**
   * Format note DTO, sanitizing mentions if user is not authorized to see specific recipient list.
   */
  private formatNoteDto(note: any, currentUserId: string, isAdmin: boolean) {
    const isAuthor = note.createdById === currentUserId;
    const canSeeRecipients = isAdmin || isAuthor || note.mentions?.some((m: any) => m.userId === currentUserId);

    return {
      id: note.id,
      projectId: note.projectId,
      title: note.title,
      content: note.content,
      color: note.color || 'yellow',
      tags: note.tags || [],
      visibility: note.visibility,
      pinned: note.pinned,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      createdBy: note.createdBy,
      updatedBy: note.updatedBy,
      project: note.project,
      attachments: note.attachments ? note.attachments.map((att: any) => ({
        id: att.id,
        projectId: att.projectId,
        uploadedById: att.uploadedById,
        uploadedBy: att.uploadedBy,
        noteId: att.noteId,
        workItemId: att.workItemId,
        originalName: att.originalName,
        storageKey: att.storageKey,
        mimeType: att.mimeType,
        sizeBytes: att.sizeBytes,
        extension: att.extension,
        category: att.category,
        createdAt: att.createdAt,
        updatedAt: att.updatedAt,
      })) : [],
      mentions: canSeeRecipients && note.mentions
        ? note.mentions.map((m: any) => ({
            id: m.user.id,
            fullName: m.user.fullName,
            username: m.user.username,
            avatarUrl: m.user.avatarUrl,
          }))
        : [],
    };
  }
}

export const noteService = new NoteService();
