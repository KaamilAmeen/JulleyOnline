import { z } from 'zod';

export const uuidSchema = z.string().uuid('Must be a valid UUID');

export const idParamsSchema = z.object({ id: uuidSchema });

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().uuid().optional(),
});

export const roleSchema = z.enum(['ORG_ADMIN', 'TENANT_ADMIN', 'MEMBER']);
export const prioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
