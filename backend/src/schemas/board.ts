import { z } from 'zod';

export const createBoardSchema = z.object({
  name: z.string().trim().min(2, 'Board name is too short').max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  templateColumns: z
    .array(z.string().trim().min(1).max(80))
    .min(1)
    .max(10)
    .optional(),
});

export const updateBoardSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
});

export const createColumnSchema = z.object({
  name: z.string().trim().min(1, 'Column name is required').max(80),
});

export const updateColumnSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
});

export const reorderColumnsSchema = z.object({
  boardId: z.string().uuid(),
  orderedIds: z.array(z.string().uuid()).min(1),
});
