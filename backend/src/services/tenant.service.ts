import type { Role } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { highestRole, resolveTenantMembership } from '../middleware/tenant.js';
import { POSITION_GAP } from '../utils/position.js';
import { ApiError } from '../utils/errors.js';
import { uniqueSlug } from '../utils/slug.js';
import { ACTIVITY_USER_SELECT, broadcastActivity, recordActivity } from './activity.service.js';
import { DEFAULT_COLUMNS } from './organization.service.js';

/** Creates a branch plus a starter board with the four default columns. */
export async function createTenant(organizationId: string, name: string, actorId: string) {
  const slug = await uniqueSlug(name, async (candidate) => {
    const count = await prisma.tenant.count({ where: { organizationId, slug: candidate } });
    return count > 0;
  });

  const tenantId = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ data: { organizationId, name, slug } });

    const board = await tx.board.create({
      data: {
        organizationId,
        tenantId: tenant.id,
        name: 'Getting Started',
        description: `Starter board for ${name}`,
        createdBy: actorId,
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
        organizationId,
        userId: actorId,
        entityType: 'tenant',
        entityId: tenant.id,
        action: 'CREATED',
        details: { name },
      },
    });

    return tenant.id;
  });

  return getTenantForUser(tenantId, actorId);
}

export async function listTenantsForUser(userId: string, organizationId?: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId, ...(organizationId ? { organizationId } : {}) },
    select: { role: true, organizationId: true, tenantId: true },
  });

  const adminOrgIds = memberships
    .filter((membership) => membership.role === 'ORG_ADMIN' && membership.tenantId === null)
    .map((membership) => membership.organizationId);
  const directTenantIds = memberships
    .map((membership) => membership.tenantId)
    .filter((id): id is string => Boolean(id));

  const tenants = await prisma.tenant.findMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
      OR: [{ organizationId: { in: adminOrgIds } }, { id: { in: directTenantIds } }],
    },
    orderBy: { name: 'asc' },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
      _count: { select: { boards: true, memberships: true } },
    },
  });

  const roleByTenant = new Map(
    memberships
      .filter((membership) => membership.tenantId)
      .map((membership) => [membership.tenantId as string, membership.role]),
  );

  return tenants.map((tenant) => ({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    organizationId: tenant.organizationId,
    organizationName: tenant.organization.name,
    organizationSlug: tenant.organization.slug,
    role: adminOrgIds.includes(tenant.organizationId) ? ('ORG_ADMIN' as Role) : (roleByTenant.get(tenant.id) ?? 'MEMBER'),
    boardCount: tenant._count.boards,
    memberCount: tenant._count.memberships,
  }));
}

export async function getTenantForUser(tenantId: string, userId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
      _count: { select: { boards: true, memberships: true } },
    },
  });
  if (!tenant) throw ApiError.notFound('Tenant not found');

  const membership = await resolveTenantMembership(userId, tenant);
  if (!membership) throw ApiError.forbidden('You are not a member of this tenant');

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    organizationId: tenant.organizationId,
    organizationName: tenant.organization.name,
    organizationSlug: tenant.organization.slug,
    role: membership.role,
    boardCount: tenant._count.boards,
    memberCount: tenant._count.memberships,
    createdAt: tenant.createdAt,
  };
}

export async function updateTenant(
  tenantId: string,
  organizationId: string,
  name: string,
  actorId: string,
) {
  const updated = await prisma.tenant.update({ where: { id: tenantId }, data: { name } });

  const activity = await recordActivity(prisma, {
    tenantId,
    organizationId,
    userId: actorId,
    entityType: 'tenant',
    entityId: tenantId,
    action: 'UPDATED',
    details: { name },
  });
  broadcastActivity(tenantId, activity);
  return updated;
}

export async function deleteTenant(tenantId: string): Promise<void> {
  await prisma.tenant.delete({ where: { id: tenantId } });
}

export async function listTenantMembers(tenantId: string) {
  return prisma.membership.findMany({
    where: { tenantId },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      role: true,
      tenantId: true,
      createdAt: true,
      user: { select: ACTIVITY_USER_SELECT },
    },
  });
}

/**
 * Everyone who can be assigned work in a tenant: tenant members plus the
 * organization admins (who have implicit access to every branch).
 * Returns a de-duplicated, role-ranked list for pickers.
 */
export async function listTenantPeople(tenantId: string, organizationId: string) {
  const [tenantMemberships, orgAdmins] = await Promise.all([
    prisma.membership.findMany({
      where: { tenantId },
      select: { role: true, user: { select: ACTIVITY_USER_SELECT } },
    }),
    prisma.membership.findMany({
      where: { organizationId, tenantId: null, role: 'ORG_ADMIN' },
      select: { role: true, user: { select: ACTIVITY_USER_SELECT } },
    }),
  ]);

  const people = new Map<string, { id: string; name: string; email: string; avatarColor: string; role: Role }>();
  for (const membership of [...tenantMemberships, ...orgAdmins]) {
    const existing = people.get(membership.user.id);
    const role = existing ? highestRole([existing.role, membership.role]) : membership.role;
    people.set(membership.user.id, { ...membership.user, role });
  }

  return [...people.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email),
  );
}

export async function addTenantMember(
  tenantId: string,
  organizationId: string,
  input: { email: string; role: 'TENANT_ADMIN' | 'MEMBER' },
  actorId: string,
) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true, name: true },
  });
  if (!user) throw ApiError.notFound('No account exists with that email. Ask them to register first.');

  const existing = await prisma.membership.findFirst({
    where: { userId: user.id, tenantId },
    select: { id: true },
  });
  if (existing) throw new ApiError(409, 'MEMBERSHIP_EXISTS', 'This user is already a member of the branch');

  const membership = await prisma.membership.create({
    data: { userId: user.id, organizationId, tenantId, role: input.role },
    select: {
      id: true,
      role: true,
      tenantId: true,
      createdAt: true,
      user: { select: ACTIVITY_USER_SELECT },
    },
  });

  const activity = await recordActivity(prisma, {
    tenantId,
    organizationId,
    userId: actorId,
    entityType: 'member',
    entityId: membership.id,
    action: 'MEMBER_ADDED',
    details: { memberEmail: user.email, role: input.role },
  });
  broadcastActivity(tenantId, activity);
  return membership;
}

export async function updateTenantMember(
  tenantId: string,
  organizationId: string,
  membershipId: string,
  role: 'TENANT_ADMIN' | 'MEMBER',
  actorId: string,
) {
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, tenantId },
    select: { id: true, role: true, user: { select: { email: true } } },
  });
  if (!membership) throw ApiError.notFound('Membership not found');

  const updated = await prisma.membership.update({
    where: { id: membershipId },
    data: { role },
    select: {
      id: true,
      role: true,
      tenantId: true,
      createdAt: true,
      user: { select: ACTIVITY_USER_SELECT },
    },
  });

  const activity = await recordActivity(prisma, {
    tenantId,
    organizationId,
    userId: actorId,
    entityType: 'member',
    entityId: membership.id,
    action: 'MEMBER_UPDATED',
    details: { memberEmail: membership.user.email, from: membership.role, to: role },
  });
  broadcastActivity(tenantId, activity);
  return updated;
}

export async function removeTenantMember(
  tenantId: string,
  organizationId: string,
  membershipId: string,
  actorId: string,
): Promise<void> {
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, tenantId },
    select: { id: true, user: { select: { email: true } } },
  });
  if (!membership) throw ApiError.notFound('Membership not found');

  await prisma.membership.delete({ where: { id: membershipId } });

  const activity = await recordActivity(prisma, {
    tenantId,
    organizationId,
    userId: actorId,
    entityType: 'member',
    entityId: membership.id,
    action: 'MEMBER_REMOVED',
    details: { memberEmail: membership.user.email },
  });
  broadcastActivity(tenantId, activity);
}
