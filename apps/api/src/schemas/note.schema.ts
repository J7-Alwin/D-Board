import { z } from 'zod';

export const createNoteSchema = z.object({
  title: z
    .string()
    .min(1, 'Note title is required')
    .max(200, 'Title cannot exceed 200 characters')
    .transform((val) => val.trim()),
  content: z
    .string()
    .min(1, 'Note content is required')
    .max(50000, 'Content cannot exceed 50,000 characters'),
  color: z.string().optional().default('yellow'),
  tags: z.array(z.string()).optional().default([]),
  pinned: z.boolean().optional().default(false),
  attachmentIds: z.array(z.string().uuid()).optional().default([]),
});

export const updateNoteSchema = z.object({
  title: z
    .string()
    .min(1, 'Note title cannot be empty')
    .max(200, 'Title cannot exceed 200 characters')
    .transform((val) => val.trim())
    .optional(),
  content: z
    .string()
    .min(1, 'Note content cannot be empty')
    .max(50000, 'Content cannot exceed 50,000 characters')
    .optional(),
  color: z.string().optional(),
  tags: z.array(z.string()).optional(),
  pinned: z.boolean().optional(),
  attachmentIds: z.array(z.string().uuid()).optional(),
});

export const noteQuerySchema = z.object({
  search: z.string().optional(),
  visibility: z.enum(['ALL', 'TEAM', 'USERS']).optional().default('ALL'),
  tag: z.string().optional(),
  color: z.string().optional(),
  pinned: z
    .string()
    .optional()
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    }),
  authorId: z.string().uuid().optional(),
  sort: z.enum(['recentUpdated', 'recentCreated', 'title']).optional().default('recentUpdated'),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(Math.max(parseInt(val, 10), 1), 100) : 50)),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(parseInt(val, 10), 0) : 0)),
});

export interface CreateNoteInput {
  title: string;
  content: string;
  color?: string;
  tags?: string[];
  pinned?: boolean;
  attachmentIds?: string[];
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
  color?: string;
  tags?: string[];
  pinned?: boolean;
  attachmentIds?: string[];
}

export interface NoteQueryParams {
  search?: string;
  visibility?: 'ALL' | 'TEAM' | 'USERS';
  tag?: string;
  color?: string;
  pinned?: boolean;
  authorId?: string;
  sort?: 'recentUpdated' | 'recentCreated' | 'title';
  limit?: number;
  offset?: number;
}
