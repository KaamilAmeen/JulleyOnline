import { z } from 'zod';
import { prioritySchema, uuidSchema } from './common.js';

const title = z.string().trim().min(1, 'Title is required').max(200);
const description = z.string().max(10_000).nullable().optional();
const dueDate = z
  .string()
  .datetime({ offset: true, message: 'Use an ISO-8601 date' })
  .nullable()
  .optional();

export const createTaskSchema = z.object({
  boardId: uuidSchema,
  columnId: uuidSchema,
  title,
  description,
  priority: prioritySchema.optional(),
  assignedTo: uuidSchema.nullable().optional(),
  dueDate,
});

export const updateTaskSchema = z
  .object({
    title: title.optional(),
    description,
    priority: prioritySchema.optional(),
    assignedTo: uuidSchema.nullable().optional(),
    dueDate,
    version: z.number().int().min(1),
  })
  .refine((value) => Object.keys(value).length > 1, {
    message: 'Provide at least one field to update',
  });

export const moveTaskSchema = z.object({
  columnId: uuidSchema,
  index: z.number().int().min(0).max(10_000),
  version: z.number().int().min(1),
});

export const taskQuerySchema = z.object({
  boardId: uuidSchema.optional(),
  columnId: uuidSchema.optional(),
  assignedTo: uuidSchema.optional(),
  search: z.string().trim().max(200).optional(),
  overdue: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
