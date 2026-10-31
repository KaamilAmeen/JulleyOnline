import type { Role } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/errors.js';

export interface MembershipContext {
  membershipId: string;
  role: Role;
  organizationId: string;
}

export interface TenantContext {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: Role;
  membershipId: string;
}

export interface OrganizationContext {
  id: string;
  name: string;
  slug: string;
  role: Role;
  membershipId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenant?: TenantContext;
      organization?: OrganizationContext;
    }
  }
}

const ROLE_RANK: Record<Role, number> = { MEMBER: 1, TENANT_ADMIN: 2, ORG_ADMIN: 3 };

export function highestRole(roles: Role[]): Role {
  return roles.reduce<Role>((best, role) => (ROLE_RANK[role] > ROLE_RANK[best] ? role : best), 'MEMBER');
}

/**
 * Resolves the effective role of a user inside a tenant.
 * A tenant-specific membership wins; otherwise an organization-wide ORG_ADMIN
 * membership grants access to every tenant of that organization.
 */
export async function resolveTenantMembership(
  userId: string,
  tenant: { id: string; organizationId: string },
): Promise<MembershipContext | null> {
  const tenantMembership = await prisma.membership.findFirst({
    where: { userId, tenantId: tenant.id, organizationId: tenant.organizationId },
    select: { id: true, role: true, organizationId: true },
  });
  if (tenantMembership) {
    return {
      membershipId: tenantMembership.id,
      role: tenantMembership.role,
      organizationId: tenantMembership.organizationId,
    };
  }

  const orgAdmin = await prisma.membership.findFirst({
    where: {
      userId,
      organizationId: tenant.organizationId,
      tenantId: null,
      role: 'ORG_ADMIN',
    },
    select: { id: true, role: true, organizationId: true },
  });
  if (orgAdmin) {
    return {
      membershipId: orgAdmin.id,
      role: orgAdmin.role,
      organizationId: orgAdmin.organizationId,
    };
  }
  return null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Resolves and authorizes the active tenant from the `X-Tenant-Id` header.
 * The client can never obtain another tenant's data by forging this header:
 * the value is checked against the authenticated user's memberships.
 */
export async function requireTenant(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw ApiError.unauthorized();

    const tenantId = (req.header('x-tenant-id') ?? (req.params.tenantId as string | undefined))?.trim();
    if (!tenantId) throw ApiError.badRequest('X-Tenant-Id header is required');
    if (!UUID_RE.test(tenantId)) throw ApiError.badRequest('X-Tenant-Id must be a UUID');

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        organizationId: true,
        organization: { select: { name: true, slug: true } },
      },
    });
    if (!tenant) throw ApiError.notFound('Tenant not found');

    const membership = await resolveTenantMembership(req.user.id, tenant);
    if (!membership) throw ApiError.forbidden('You are not a member of this tenant');

    req.tenant = {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      organizationId: tenant.organizationId,
      organizationName: tenant.organization.name,
      organizationSlug: tenant.organization.slug,
      role: membership.role,
      membershipId: membership.membershipId,
    };
    next();
  } catch (error) {
    next(error);
  }
}

/** Authorizes organization-level routes (`/api/organizations/:organizationId/...`). */
export async function requireOrganization(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw ApiError.unauthorized();

    const organizationId = (req.params.organizationId ?? req.params.id) as string | undefined;
    if (!organizationId) throw ApiError.badRequest('Organization id is required');

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, slug: true },
    });
    if (!organization) throw ApiError.notFound('Organization not found');

    const memberships = await prisma.membership.findMany({
      where: { userId: req.user.id, organizationId },
      select: { id: true, role: true },
    });
    if (memberships.length === 0) throw ApiError.forbidden('You are not a member of this organization');

    req.organization = {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      role: highestRole(memberships.map((membership) => membership.role)),
      membershipId: memberships[0]!.id,
    };
    next();
  } catch (error) {
    next(error);
  }
}

export function currentTenant(req: Request): TenantContext {
  if (!req.tenant) throw ApiError.forbidden('A tenant context is required');
  return req.tenant;
}

export function currentOrganization(req: Request): OrganizationContext {
  if (!req.organization) throw ApiError.forbidden('An organization context is required');
  return req.organization;
}
