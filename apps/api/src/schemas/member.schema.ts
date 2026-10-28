import { z } from 'zod';

export const updateMemberRoleSchema = z.object({
  role: z.enum(['PROJECT_ADMIN', 'PROJECT_MEMBER'], {
    message: 'Role must be either PROJECT_ADMIN or PROJECT_MEMBER',
  }),
});

export const addMemberSchema = z.object({
  userId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  role: z.enum(['PROJECT_ADMIN', 'PROJECT_MEMBER']).default('PROJECT_MEMBER'),
}).refine((data) => Boolean(data.userId || data.email), {
  message: 'Either userId or email must be provided',
});

export const executeHandoverSchema = z.object({
  action: z.enum(['DEMOTE', 'REMOVE']),
  replacementUserId: z.string().uuid().optional(),
  reassignTasksToUserId: z.string().uuid().optional(),
  note: z.string().max(500).optional(),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type ExecuteHandoverInput = z.infer<typeof executeHandoverSchema>;

