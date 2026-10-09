import { z } from 'zod';

export const fileQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  category: z
    .enum([
      'ALL',
      'IMAGE',
      'PDF',
      'DOCUMENT',
      'SPREADSHEET',
      'PRESENTATION',
      'TEXT',
      'CODE',
      'DATA',
      'ARCHIVE',
      'OTHER',
    ])
    .optional()
    .default('ALL'),
  search: z.string().optional(),
  workItemId: z.string().uuid().optional(),
  noteId: z.string().uuid().optional(),
  isPrivate: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  sortBy: z.enum(['createdAt', 'originalName', 'sizeBytes']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const renameFileSchema = z.object({
  name: z.string().min(1, 'File name is required').max(255, 'File name is too long'),
});

export const updateFileVisibilitySchema = z.object({
  isPrivate: z.boolean().optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
});

export const attachFileSchema = z.object({
  workItemId: z.string().uuid().nullable().optional(),
  noteId: z.string().uuid().nullable().optional(),
  isPrivate: z.boolean().optional(),
});

export type FileQueryParams = z.infer<typeof fileQuerySchema>;
export type RenameFileInput = z.infer<typeof renameFileSchema>;
export type UpdateFileVisibilityInput = z.infer<typeof updateFileVisibilitySchema>;
export type AttachFileInput = z.infer<typeof attachFileSchema>;
