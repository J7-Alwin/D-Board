import { z } from 'zod';

export const updateMemberRoleSchema = z.object({
  role: z.enum(['PROJECT_ADMIN', 'PROJECT_MEMBER'], {
    message: 'Role must be either PROJECT_ADMIN or PROJECT_MEMBER',
  }),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
