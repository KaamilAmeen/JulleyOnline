import { z } from 'zod';

export const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  entityType: z.string().trim().max(40).optional(),
  entityId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  boardId: z.string().uuid().optional(),
});

export const aiQuerySchema = z.object({
  question: z.string().trim().min(2, 'Ask a question').max(1000),
});
