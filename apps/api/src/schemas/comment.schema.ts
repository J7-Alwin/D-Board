import { z } from "zod";

export const createCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(2000, "Comment cannot exceed 2000 characters"),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(2000, "Comment cannot exceed 2000 characters"),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
