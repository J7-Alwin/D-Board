import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: 'Project name must be at least 2 characters' })
    .max(100, { message: 'Project name cannot exceed 100 characters' }),
  key: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_-]{2,10}$/i, { message: 'Project key must be 2-10 alphanumeric characters' })
    .optional()
    .nullable(),
  description: z
    .string()
    .trim()
    .min(5, { message: 'Project description must be at least 5 characters' })
    .max(1000, { message: 'Project description cannot exceed 1000 characters' }),
  category: z.string().trim().max(50).optional().nullable(),
  technologyStack: z.array(z.string().trim()).optional().default([]),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  repositoryUrl: z
    .string()
    .trim()
    .url({ message: 'Repository URL must be a valid URL' })
    .optional()
    .nullable()
    .or(z.literal('')),
  liveUrl: z
    .string()
    .trim()
    .url({ message: 'Live URL must be a valid URL' })
    .optional()
    .nullable()
    .or(z.literal('')),
  avatarUrl: z.string().trim().optional().nullable().or(z.literal('')),
  invitations: z
    .array(
      z.object({
        email: z.string().trim().email({ message: 'Invalid email in invitations' }),
        role: z.enum(['PROJECT_ADMIN', 'PROJECT_MEMBER']).optional().default('PROJECT_MEMBER'),
        message: z.string().trim().max(300).optional().nullable(),
      })
    )
    .optional()
    .default([]),
});

export const updateProjectSchema = createProjectSchema.partial();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
