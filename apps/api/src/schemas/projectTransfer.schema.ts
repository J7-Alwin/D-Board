import { z } from 'zod';

  export const requestProjectTransferSchema = z
    .object({
      destinationWorkspaceId: z.string().uuid('Invalid destination workspace ID format').optional(),
      destinationUserEmail: z.string().trim().email('Invalid email address format').optional(),
      destinationWorkspaceName: z.string().trim().min(1, 'Workspace name is required').max(100).optional(),
    })
    .refine(
      (data) => Boolean(data.destinationWorkspaceId || (data.destinationUserEmail && data.destinationWorkspaceName)),
      {
        message: 'Either select a destination workspace or provide the recipient email and destination workspace name',
        path: ['destinationWorkspaceName'],
      }
    );

export const approveProjectTransferSchema = z.object({
  memberAction: z.enum(['INVITE_ALL', 'DECIDE_LATER', 'REMOVE_ALL']).optional(),
  sharedMemberDecisions: z.record(z.string(), z.enum(['KEEP', 'REMOVE'])).optional(),
  newProjectKey: z.string().trim().min(2).max(10).optional().nullable(),
});

  export const rejectProjectTransferSchema = z.object({
    reason: z.string().trim().max(500, 'Rejection reason cannot exceed 500 characters').optional().nullable(),
  });

  export type RequestProjectTransferInput = z.infer<typeof requestProjectTransferSchema>;
  export type ApproveProjectTransferInput = z.infer<typeof approveProjectTransferSchema>;
  export type RejectProjectTransferInput = z.infer<typeof rejectProjectTransferSchema>;
