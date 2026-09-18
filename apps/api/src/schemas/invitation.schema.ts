import { z } from 'zod';

export const createInvitationSchema = z.object({
  email: z.string().email('Please enter a valid email address').trim().toLowerCase(),
  role: z.enum(['PROJECT_ADMIN', 'PROJECT_MEMBER']).default('PROJECT_MEMBER'),
  message: z.string().max(500, 'Message cannot exceed 500 characters').optional().nullable(),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
