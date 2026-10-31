import { z } from 'zod';
import { roleSchema, uuidSchema } from './common.js';

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, 'Organization name is too short').max(120),
});

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
});

export const addOrganizationMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: roleSchema,
  tenantId: uuidSchema.nullable().optional(),
});

export const updateMembershipSchema = z.object({
  role: roleSchema,
});
