import { z } from 'zod';
import { roleSchema } from './common.js';

export const createTenantSchema = z.object({
  name: z.string().trim().min(2, 'Branch name is too short').max(120),
});

export const updateTenantSchema = z.object({
  name: z.string().trim().min(2).max(120),
});

export const addTenantMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(['TENANT_ADMIN', 'MEMBER']),
});

export const updateTenantMembershipSchema = z.object({
  role: z.enum(['TENANT_ADMIN', 'MEMBER']),
});

export const tenantMemberRoleSchema = roleSchema;
