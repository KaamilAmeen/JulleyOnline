import type { Prisma, Role } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { resolveTenantMembership } from '../middleware/tenant.js';
import { emitToTenant } from '../realtime/bus.js';
import { ApiError } from '../utils/errors.js';
import { POSITION_GAP, positionBetween } from '../utils/position.js';
import { ACTIVITY_USER_SELECT, broadcastActivity, recordActivity } from './activity.service.js';

const TASK_INCLUDE = {
  assignee: { select: ACTIVITY_USER_SELECT },
  creator: { select: ACTIVITY_USER_SELECT },
} satisfies Prisma.TaskInclude;

function conflictWith(task: unknown): ApiError {
  return ApiError.conflict(
    'This task changed since you loaded it. Review the latest version and try again.',
    { currentTask: task },
  );
}

async function assertAssigneeInTenant(assignedTo: string, tenantId: string, organizationId: string) {
  const membership = await resolveTenantMembership(assignedTo, { id: tenantId, organizationId });
  if (!membership) {
    throw ApiError.badRequest('The assigned user is not a member of this branch');
  }
}

export async function listTasks(
  tenantId: string,
  filters: {
    boardId?: string;
    columnId?: string;
    assignedTo?: string;
    search?: string;
    overdue?: boolean;
    limit: number;
  },
) {
  const where: Prisma.TaskWhereInput = { tenantId };
  if (filters.boardId) where.boardId = filters.boardId;
  if (filters.columnId) where.columnId = filters.columnId;
  if (filters.assignedTo) where.assignedTo = filters.assignedTo;
  if (filters.search) where.title = { contains: filters.search, mode: 'insensitive' };
  if (filters.overdue) {
    where.AND = [{ dueDate: { lt: new Date() } }, { dueDate: { not: null } }];
  }

  return prisma.task.findMany({
    where,
    take: filters.limit,
    orderBy: [{ boardId: 'asc' }, { columnId: 'asc' }, { position: 'asc' }],
    include: TASK_INCLUDE,
  });
}

export async function getTask(tenantId: string, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, tenantId },
    include: TASK_INCLUDE,
  });
  if (!task) throw ApiError.notFound('Task not found');
  return task;
}

export async function createTask(
  tenantId: string,
  organizationId: string,
  userId: string,
  input: {
    boardId: string;
    columnId: string;
    title: string;
    description?: string | null;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    assignedTo?: string | null;
    dueDate?: string | null;
  },
) {
  const board = await prisma.board.findFirst({
    where: { id: input.boardId, tenantId },
    select: { id: true },
  });
  if (!board) throw ApiError.notFound('Board not found');

  const column = await prisma.boardColumn.findFirst({
    where: { id: input.columnId, tenantId, boardId: input.boardId },
    select: { id: true },
  });
  if (!column) throw ApiError.badRequest('The column does not belong to this board');

  if (input.assignedTo) {
    await assertAssigneeInTenant(input.assignedTo, tenantId, organizationId);
  }

  const last = await prisma.task.findFirst({
    where: { columnId: input.columnId, tenantId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  const taskId = await prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        boardId: input.boardId,
        columnId: input.columnId,
        tenantId,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority ?? 'MEDIUM',
        assignedTo: input.assignedTo ?? null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        position: (last?.position ?? 0) + POSITION_GAP,
        createdBy: userId,
      },
    });

    await tx.activityLog.create({
      data: {
        tenantId,
        organizationId,
        userId,
        entityType: 'task',
        entityId: task.id,
        action: 'CREATED',
        details: { title: task.title, columnId: task.columnId, boardId: task.boardId },
      },
    });

    return task.id;
  });

  const task = await getTask(tenantId, taskId);
  emitToTenant(tenantId, 'task:created', task);
  return task;
}

export async function updateTask(
  tenantId: string,
  organizationId: string,
  userId: string,
  taskId: string,
  input: {
    title?: string;
    description?: string | null;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    assignedTo?: string | null;
    dueDate?: string | null;
    version: number;
  },
) {
  if (input.assignedTo) {
    await assertAssigneeInTenant(input.assignedTo, tenantId, organizationId);
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.task.findFirst({
      where: { id: taskId, tenantId },
      include: TASK_INCLUDE,
    });
    if (!existing) throw ApiError.notFound('Task not found');
    if (existing.version !== input.version) throw conflictWith(existing);

    const data: Prisma.TaskUncheckedUpdateManyInput = { version: { increment: 1 } };
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    if (input.title !== undefined) {
      data.title = input.title;
      changes.title = { from: existing.title, to: input.title };
    }
    if (input.description !== undefined) {
      data.description = input.description;
      changes.description = { from: existing.description, to: input.description };
    }
    if (input.priority !== undefined) {
      data.priority = input.priority;
      changes.priority = { from: existing.priority, to: input.priority };
    }
    if (input.assignedTo !== undefined) {
      data.assignedTo = input.assignedTo;
      changes.assignedTo = { from: existing.assignedTo, to: input.assignedTo };
    }
    if (input.dueDate !== undefined) {
      data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
      changes.dueDate = { from: existing.dueDate, to: input.dueDate };
    }

    const updated = await tx.task.updateMany({
      where: { id: taskId, tenantId, version: input.version },
      data,
    });
    if (updated.count === 0) {
      const current = await tx.task.findFirst({ where: { id: taskId, tenantId }, include: TASK_INCLUDE });
      throw conflictWith(current);
    }

    const task = await tx.task.findFirst({ where: { id: taskId }, include: TASK_INCLUDE });
    if (!task) throw ApiError.notFound('Task not found');

    const activity = await tx.activityLog.create({
      data: {
        tenantId,
        organizationId,
        userId,
        entityType: 'task',
        entityId: taskId,
        action: 'UPDATED',
        details: { title: task.title, changes } as Prisma.InputJsonValue,
      },
      include: { user: { select: ACTIVITY_USER_SELECT } },
    });

    return { task, activity };
  });

  broadcastActivity(tenantId, result.activity);
  emitToTenant(tenantId, 'task:updated', result.task);
  return result.task;
}

export async function moveTask(
  tenantId: string,
  organizationId: string,
  userId: string,
  taskId: string,
  input: { columnId: string; index: number; version: number },
) {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.task.findFirst({
      where: { id: taskId, tenantId },
      include: TASK_INCLUDE,
    });
    if (!existing) throw ApiError.notFound('Task not found');
    if (existing.version !== input.version) throw conflictWith(existing);

    const targetColumn = await tx.boardColumn.findFirst({
      where: { id: input.columnId, tenantId, boardId: existing.boardId },
      select: { id: true },
    });
    if (!targetColumn) {
      throw ApiError.badRequest('The destination column does not belong to this board');
    }

    const siblings = await tx.task.findMany({
      where: { columnId: input.columnId, tenantId, id: { not: taskId } },
      orderBy: { position: 'asc' },
      select: { id: true, position: true },
    });

    const index = Math.min(Math.max(input.index, 0), siblings.length);
    const prev = index > 0 ? siblings[index - 1]?.position ?? null : null;
    const next = index < siblings.length ? siblings[index]?.position ?? null : null;
    const computed = positionBetween(prev, next);

    let position: number;
    if (computed === null) {
      // Positions became too dense: re-space the whole destination column.
      const ordered = siblings.map((sibling) => ({ id: sibling.id, position: sibling.position }));
      ordered.splice(index, 0, { id: taskId, position: 0 });
      const spaced = ordered.map((task, taskIndex) => ({
        id: task.id,
        position: (taskIndex + 1) * POSITION_GAP,
      }));
      for (const task of spaced) {
        if (task.id !== taskId) {
          await tx.task.update({ where: { id: task.id }, data: { position: task.position } });
        }
      }
      position = spaced[index]!.position;
    } else {
      position = computed;
    }

    const moved = await tx.task.updateMany({
      where: { id: taskId, tenantId, version: input.version },
      data: { columnId: input.columnId, position, version: { increment: 1 } },
    });
    if (moved.count === 0) {
      const current = await tx.task.findFirst({ where: { id: taskId, tenantId }, include: TASK_INCLUDE });
      throw conflictWith(current);
    }

    const task = await tx.task.findFirst({ where: { id: taskId }, include: TASK_INCLUDE });
    if (!task) throw ApiError.notFound('Task not found');

    const activity = await tx.activityLog.create({
      data: {
        tenantId,
        organizationId,
        userId,
        entityType: 'task',
        entityId: taskId,
        action: 'MOVED',
        details: {
          title: task.title,
          fromColumnId: existing.columnId,
          toColumnId: input.columnId,
          index,
        },
      },
      include: { user: { select: ACTIVITY_USER_SELECT } },
    });

    return { task, activity, fromColumnId: existing.columnId };
  });

  broadcastActivity(tenantId, result.activity);
  emitToTenant(tenantId, 'task:moved', {
    task: result.task,
    fromColumnId: result.fromColumnId,
    toColumnId: result.task.columnId,
  });
  return result.task;
}

export async function deleteTask(
  tenantId: string,
  organizationId: string,
  userId: string,
  role: Role,
  taskId: string,
): Promise<void> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, tenantId },
    select: { id: true, title: true, columnId: true, boardId: true, createdBy: true },
  });
  if (!task) throw ApiError.notFound('Task not found');

  if (role === 'MEMBER' && task.createdBy !== userId) {
    throw ApiError.forbidden('Members can only delete tasks they created');
  }

  await prisma.task.delete({ where: { id: taskId } });

  const activity = await recordActivity(prisma, {
    tenantId,
    organizationId,
    userId,
    entityType: 'task',
    entityId: taskId,
    action: 'DELETED',
    details: { title: task.title, columnId: task.columnId, boardId: task.boardId },
  });
  broadcastActivity(tenantId, activity);
  emitToTenant(tenantId, 'task:deleted', {
    taskId,
    boardId: task.boardId,
    columnId: task.columnId,
  });
}

export async function getTaskActivity(tenantId: string, taskId: string, limit: number) {
  const task = await prisma.task.findFirst({ where: { id: taskId, tenantId }, select: { id: true } });
  if (!task) throw ApiError.notFound('Task not found');

  return prisma.activityLog.findMany({
    where: { tenantId, entityType: 'task', entityId: taskId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { user: { select: ACTIVITY_USER_SELECT } },
  });
}
