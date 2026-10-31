import type { Role } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { highestRole } from '../middleware/tenant.js';
import { POSITION_GAP } from '../utils/position.js';
import { ApiError } from '../utils/errors.js';
import { uniqueSlug } from '../utils/slug.js';
import { ACTIVITY_USER_SELECT, broadcastActivity, recordActivity } from './activity.service.js';

export const DEFAULT_COLUMNS = ['To Do', 'In Progress', 'Testing', 'Done'];

/** Creates an organization, its first tenant, a starter board and the owner membership. */
export async function createOrganization(userId: string, name: string) {
  const slug = await uniqueSlug(name, async (candidate) => {
    const count = await prisma.organization.count({ where: { slug: candidate } });
    return count > 0;
  });

  const organizationId = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({ data: { name, slug } });

    await tx.membership.create({
      data: { userId, organizationId: organization.id, tenantId: null, role: 'ORG_ADMIN' },
    });

    const tenant = await tx.tenant.create({
      data: { organizationId: organization.id, name: 'Head Office', slug: 'head-office' },
    });

    const board = await tx.board.create({
      data: {
        organizationId: organization.id,
        tenantId: tenant.id,
        name: 'My First Board',
        description: 'A starter board — rename it or create a new one.',
        createdBy: userId,
      },
    });

    await tx.boardColumn.createMany({
      data: DEFAULT_COLUMNS.map((columnName, index) => ({
        boardId: board.id,
        tenantId: tenant.id,
        name: columnName,
        position: (index + 1) * POSITION_GAP,
      })),
    });

    await tx.activityLog.create({
      data: {
        tenantId: tenant.id,
        organizationId: organization.id,
        userId,
        entityType: 'organization',
        entityId: organization.id,
        action: 'CREATED',
        details: { name },
      },
    });

    return organization.id;
  });

  return getOrganizationForUser(organizationId, userId);
}

export async function listOrganizationsForUser(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: {
      organization: {
        include: {
          tenants: {
            orderBy: { name: 'asc' },
            include: { _count: { select: { boards: true, memberships: true } } },
          },
        },
      },
      tenant: { select: { id: true, name: true, slug: true } },
    },
  });

  const grouped = new Map<
    string,
    {
      organization: (typeof memberships)[number]['organization'];
      roles: Role[];
      tenantIds: Set<string>;
      orgAdmin: boolean;
    }
  >();

  for (const membership of memberships) {
    const current = grouped.get(membership.organizationId) ?? {
      organization: membership.organization,
      roles: [],
      tenantIds: new Set<string>(),
      orgAdmin: false,
    };
    current.roles.push(membership.role);
    if (membership.tenantId) current.tenantIds.add(membership.tenantId);
    if (membership.role === 'ORG_ADMIN' && membership.tenantId === null) current.orgAdmin = true;
    grouped.set(membership.organizationId, current);
  }

  return [...grouped.values()]
    .map(({ organization, roles, tenantIds, orgAdmin }) => {
      const visibleTenants = orgAdmin
        ? organization.tenants
        : organization.tenants.filter((tenant) => tenantIds.has(tenant.id));
      return {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        role: highestRole(roles),
        createdAt: organization.createdAt,
        boardCount: visibleTenants.reduce((total, tenant) => total + tenant._count.boards, 0),
        tenants: visibleTenants.map((tenant) => ({
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          boardCount: tenant._count.boards,
          memberCount: tenant._count.memberships,
        })),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getOrganizationForUser(organizationId: string, userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId, organizationId },
    select: { role: true, tenantId: true },
  });
  if (memberships.length === 0) throw ApiError.forbidden('You are not a member of this organization');

  const orgAdmin = memberships.some((membership) => membership.role === 'ORG_ADMIN' && membership.tenantId === null);
  const tenantIds = memberships.map((membership) => membership.tenantId).filter((id): id is string => Boolean(id));

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      tenants: {
        where: orgAdmin ? {} : { id: { in: tenantIds } },
        orderBy: { name: 'asc' },
        include: { _count: { select: { boards: true, memberships: true } } },
      },
      _count: { select: { memberships: true } },
    },
  });
  if (!organization) throw ApiError.notFound('Organization not found');

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    createdAt: organization.createdAt,
    role: highestRole(memberships.map((membership) => membership.role)),
    memberCount: organization._count.memberships,
    tenants: organization.tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      boardCount: tenant._count.boards,
      memberCount: tenant._count.memberships,
    })),
  };
}

export async function updateOrganization(organizationId: string, name: string) {
  return prisma.organization.update({
    where: { id: organizationId },
    data: { name },
    select: { id: true, name: true, slug: true, updatedAt: true },
  });
}

export async function deleteOrganization(organizationId: string): Promise<void> {
  await prisma.organization.delete({ where: { id: organizationId } });
}

export async function listOrganizationMembers(organizationId: string) {
  const memberships = await prisma.membership.findMany({
    where: { organizationId },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      role: true,
      tenantId: true,
      createdAt: true,
      user: { select: ACTIVITY_USER_SELECT },
      tenant: { select: { id: true, name: true } },
    },
  });
  return memberships;
}

export async function addOrganizationMember(
  organizationId: string,
  input: { email: string; role: Role; tenantId?: string | null },
  actorId: string,
) {
  if (input.role === 'ORG_ADMIN' && input.tenantId) {
    throw ApiError.badRequest('An organization admin membership cannot be scoped to a tenant');
  }
  if (input.role !== 'ORG_ADMIN' && !input.tenantId) {
    throw ApiError.badRequest('Tenant roles require a tenantId');
  }

  if (input.tenantId) {
    const tenant = await prisma.tenant.findFirst({
      where: { id: input.tenantId, organizationId },
      select: { id: true },
    });
    if (!tenant) throw ApiError.notFound('Tenant not found in this organization');
  }

  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, name: true, email: true },
  });
  if (!user) throw ApiError.notFound('No account exists with that email. Ask them to register first.');

  const existing = await prisma.membership.findFirst({
    where: { userId: user.id, organizationId, tenantId: input.tenantId ?? null },
    select: { id: true },
  });
  if (existing) throw new ApiError(409, 'MEMBERSHIP_EXISTS', 'This user already has that membership');

  const membership = await prisma.membership.create({
    data: { userId: user.id, organizationId, tenantId: input.tenantId ?? null, role: input.role },
    select: {
      id: true,
      role: true,
      tenantId: true,
      user: { select: ACTIVITY_USER_SELECT },
      tenant: { select: { id: true, name: true } },
    },
  });

  if (input.tenantId) {
    const activity = await recordActivity(prisma, {
      tenantId: input.tenantId,
      organizationId,
      userId: actorId,
      entityType: 'member',
      entityId: membership.id,
      action: 'MEMBER_ADDED',
      details: { memberEmail: user.email, role: input.role },
    });
    broadcastActivity(input.tenantId, activity);
  }

  return membership;
}

async function countOrgAdmins(organizationId: string): Promise<number> {
  return prisma.membership.count({
    where: { organizationId, role: 'ORG_ADMIN', tenantId: null },
  });
}

export async function updateOrganizationMember(
  organizationId: string,
  membershipId: string,
  role: Role,
  actorId: string,
) {
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId },
    select: { id: true, role: true, tenantId: true, userId: true, user: { select: { email: true } } },
  });
  if (!membership) throw ApiError.notFound('Membership not found');

  if (membership.role === 'ORG_ADMIN' && role !== 'ORG_ADMIN' && (await countOrgAdmins(organizationId)) <= 1) {
    throw new ApiError(409, 'LAST_ORG_ADMIN', 'An organization must keep at least one org admin');
  }
  if (role === 'ORG_ADMIN' && membership.tenantId) {
    throw ApiError.badRequest('Promote the user to an organization-level membership instead');
  }

  const updated = await prisma.membership.update({
    where: { id: membershipId },
    data: { role },
    select: {
      id: true,
      role: true,
      tenantId: true,
      user: { select: ACTIVITY_USER_SELECT },
      tenant: { select: { id: true, name: true } },
    },
  });

  if (membership.tenantId) {
    const activity = await recordActivity(prisma, {
      tenantId: membership.tenantId,
      organizationId,
      userId: actorId,
      entityType: 'member',
      entityId: membership.id,
      action: 'MEMBER_UPDATED',
      details: { memberEmail: membership.user.email, from: membership.role, to: role },
    });
    broadcastActivity(membership.tenantId, activity);
  }

  return updated;
}

export async function removeOrganizationMember(
  organizationId: string,
  membershipId: string,
  actorId: string,
) {
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId },
    select: { id: true, role: true, tenantId: true, userId: true, user: { select: { email: true } } },
  });
  if (!membership) throw ApiError.notFound('Membership not found');

  if (membership.role === 'ORG_ADMIN' && (await countOrgAdmins(organizationId)) <= 1) {
    throw new ApiError(409, 'LAST_ORG_ADMIN', 'An organization must keep at least one org admin');
  }

  await prisma.membership.delete({ where: { id: membershipId } });

  if (membership.tenantId) {
    const activity = await recordActivity(prisma, {
      tenantId: membership.tenantId,
      organizationId,
      userId: actorId,
      entityType: 'member',
      entityId: membership.id,
      action: 'MEMBER_REMOVED',
      details: { memberEmail: membership.user.email },
    });
    broadcastActivity(membership.tenantId, activity);
  }
}
