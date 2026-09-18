import { z } from 'zod';

export const createWorkItemSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, { message: 'Title must be at least 2 characters' })
    .max(200, { message: 'Title cannot exceed 200 characters' }),
  description: z.string().trim().max(5000).optional().nullable(),
  type: z
    .enum(['TASK', 'BUG', 'FEATURE', 'IMPROVEMENT', 'RESEARCH', 'DOCUMENTATION', 'OTHER'])
    .optional()
    .default('TASK'),
  status: z
    .enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'COMPLETED'])
    .optional()
    .default('TODO'),
  priority: z
    .enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .optional()
    .default('MEDIUM'),
  assignedToId: z.string().uuid().optional().nullable().or(z.literal('')),
  dueDate: z.string().optional().nullable(),
});

export const updateWorkItemSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, { message: 'Title must be at least 2 characters' })
    .max(200, { message: 'Title cannot exceed 200 characters' })
    .optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  type: z
    .enum(['TASK', 'BUG', 'FEATURE', 'IMPROVEMENT', 'RESEARCH', 'DOCUMENTATION', 'OTHER'])
    .optional(),
  status: z
    .enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'COMPLETED'])
    .optional(),
  priority: z
    .enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .optional(),
  assignedToId: z.string().uuid().optional().nullable().or(z.literal('')),
  dueDate: z.string().optional().nullable(),
});

export type CreateWorkItemInput = z.infer<typeof createWorkItemSchema>;
export type UpdateWorkItemInput = z.infer<typeof updateWorkItemSchema>;
