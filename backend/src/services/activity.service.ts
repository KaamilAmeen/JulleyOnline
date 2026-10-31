import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { emitToTenant } from '../realtime/bus.js';

export const ACTIVITY_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarColor: true,
} satisfies Prisma.UserSelect;

export interface ActivityInput {
  tenantId: string;
  organizationId: string;
  userId: string;
  entityType: 'task' | 'board' | 'column' | 'tenant' | 'organization' | 'member';
  entityId: string;
  action: 'CREATED' | 'UPDATED' | 'MOVED' | 'DELETED' | 'ASSIGNED' | 'MEMBER_ADDED' | 'MEMBER_UPDATED' | 'MEMBER_REMOVED';
  details?: Prisma.InputJsonValue;
}

type Db = PrismaClient | Prisma.TransactionClient;

/** Writes an audit row inside the caller's transaction (so it commits atomically). */
export async function recordActivity(client: Db, input: ActivityInput) {
  return client.activityLog.create({
    data: {
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      userId: input.userId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      details: input.details ?? {},
    },
    include: { user: { select: ACTIVITY_USER_SELECT } },
  });
}

export function broadcastActivity(tenantId: string, activity: unknown): void {
  emitToTenant(tenantId, 'activity:created', activity);
}

export interface ActivityFilters {
  limit: number;
  entityType?: string;
  entityId?: string;
  userId?: string;
  boardId?: string;
}

export async function listActivity(tenantId: string, filters: ActivityFilters) {
  const where: Prisma.ActivityLogWhereInput = { tenantId };
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.entityId) where.entityId = filters.entityId;
  if (filters.userId) where.userId = filters.userId;

  if (filters.boardId) {
    const taskIds = await prisma.task.findMany({
      where: { tenantId, boardId: filters.boardId },
      select: { id: true },
      take: 1000,
    });
    where.OR = [
      { entityType: 'task', entityId: { in: taskIds.map((task) => task.id) } },
      { entityType: 'board', entityId: filters.boardId },
    ];
  }

  return prisma.activityLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filters.limit,
    include: { user: { select: ACTIVITY_USER_SELECT } },
  });
}
