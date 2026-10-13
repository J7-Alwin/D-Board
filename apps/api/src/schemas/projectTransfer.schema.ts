import { z } from 'zod';

export const requestProjectTransferSchema = z.object({
  destinationWorkspaceId: z.string().uuid('Invalid destination workspace ID format'),
});

export const rejectProjectTransferSchema = z.object({
  reason: z.string().trim().max(500, 'Rejection reason cannot exceed 500 characters').optional().nullable(),
});

export type RequestProjectTransferInput = z.infer<typeof requestProjectTransferSchema>;
export type RejectProjectTransferInput = z.infer<typeof rejectProjectTransferSchema>;
