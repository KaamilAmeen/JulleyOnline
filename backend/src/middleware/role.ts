import type { Role } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/errors.js';

export type Permission =
  | 'organization:update'
  | 'organization:delete'
  | 'organization:member:manage'
  | 'tenant:create'
  | 'tenant:update'
  | 'tenant:delete'
  | 'tenant:member:manage'
  | 'board:create'
  | 'board:update'
  | 'board:delete'
  | 'column:manage'
  | 'task:create'
  | 'task:update'
  | 'task:move'
  | 'task:delete'
  | 'activity:read';

const PERMISSIONS: Record<Permission, Role[]> = {
  'organization:update': ['ORG_ADMIN'],
  'organization:delete': ['ORG_ADMIN'],
  'organization:member:manage': ['ORG_ADMIN'],
  'tenant:create': ['ORG_ADMIN'],
  'tenant:update': ['ORG_ADMIN', 'TENANT_ADMIN'],
  'tenant:delete': ['ORG_ADMIN'],
  'tenant:member:manage': ['ORG_ADMIN', 'TENANT_ADMIN'],
  'board:create': ['ORG_ADMIN', 'TENANT_ADMIN'],
  'board:update': ['ORG_ADMIN', 'TENANT_ADMIN'],
  'board:delete': ['ORG_ADMIN', 'TENANT_ADMIN'],
  'column:manage': ['ORG_ADMIN', 'TENANT_ADMIN'],
  'task:create': ['ORG_ADMIN', 'TENANT_ADMIN', 'MEMBER'],
  'task:update': ['ORG_ADMIN', 'TENANT_ADMIN', 'MEMBER'],
  'task:move': ['ORG_ADMIN', 'TENANT_ADMIN', 'MEMBER'],
  // Members may delete only tasks they created; the rule is enforced in the service.
  'task:delete': ['ORG_ADMIN', 'TENANT_ADMIN', 'MEMBER'],
  'activity:read': ['ORG_ADMIN', 'TENANT_ADMIN', 'MEMBER'],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return PERMISSIONS[permission].includes(role);
}

export function assertPermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw ApiError.forbidden(`Role ${role} cannot perform ${permission}`);
  }
}

/** Route guard for tenant-scoped endpoints (must run after requireTenant). */
export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.tenant) throw ApiError.forbidden('A tenant context is required');
      assertPermission(req.tenant.role, permission);
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Route guard for organization-scoped endpoints (must run after requireOrganization). */
export function requireOrganizationPermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.organization) throw ApiError.forbidden('An organization context is required');
      assertPermission(req.organization.role, permission);
      next();
    } catch (error) {
      next(error);
    }
  };
}
