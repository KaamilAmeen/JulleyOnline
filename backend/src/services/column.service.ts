import { prisma } from '../config/prisma.js';
import { POSITION_GAP } from '../utils/position.js';
import { ApiError } from '../utils/errors.js';
import { emitToTenant } from '../realtime/bus.js';
import { broadcastActivity, recordActivity } from './activity.service.js';

export async function listColumns(tenantId: string, boardId: string) {
  const board = await prisma.board.findFirst({ where: { id: boardId, tenantId }, select: { id: true } });
  if (!board) throw ApiError.notFound('Board not found');

  return prisma.boardColumn.findMany({
    where: { boardId, tenantId },
    orderBy: { position: 'asc' },
  });
}

export async function createColumn(
  tenantId: string,
  organizationId: string,
  userId: string,
  boardId: string,
  name: string,
) {
  const board = await prisma.board.findFirst({ where: { id: boardId, tenantId }, select: { id: true } });
  if (!board) throw ApiError.notFound('Board not found');

  const last = await prisma.boardColumn.findFirst({
    where: { boardId, tenantId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  const column = await prisma.boardColumn.create({
    data: { boardId, tenantId, name, position: (last?.position ?? 0) + POSITION_GAP },
  });

  const activity = await recordActivity(prisma, {
    tenantId,
    organizationId,
    userId,
    entityType: 'column',
    entityId: column.id,
    action: 'CREATED',
    details: { name, boardId },
  });
  broadcastActivity(tenantId, activity);
  emitToTenant(tenantId, 'column:created', column);
  return column;
}

export async function updateColumn(
  tenantId: string,
  organizationId: string,
  userId: string,
  columnId: string,
  name: string,
) {
  const existing = await prisma.boardColumn.findFirst({ where: { id: columnId, tenantId } });
  if (!existing) throw ApiError.notFound('Column not found');

  const column = await prisma.boardColumn.update({ where: { id: columnId }, data: { name } });

  const activity = await recordActivity(prisma, {
    tenantId,
    organizationId,
    userId,
    entityType: 'column',
    entityId: columnId,
    action: 'UPDATED',
    details: { from: existing.name, to: name },
  });
  broadcastActivity(tenantId, activity);
  emitToTenant(tenantId, 'column:updated', column);
  return column;
}

export async function deleteColumn(
  tenantId: string,
  organizationId: string,
  userId: string,
  columnId: string,
): Promise<void> {
  const column = await prisma.boardColumn.findFirst({ where: { id: columnId, tenantId } });
  if (!column) throw ApiError.notFound('Column not found');

  const taskCount = await prisma.task.count({ where: { columnId, tenantId } });
  if (taskCount > 0) {
    throw new ApiError(
      409,
      'COLUMN_NOT_EMPTY',
      `Move or delete the ${taskCount} task(s) in this column first`,
    );
  }

  await prisma.boardColumn.delete({ where: { id: columnId } });

  const activity = await recordActivity(prisma, {
    tenantId,
    organizationId,
    userId,
    entityType: 'column',
    entityId: columnId,
    action: 'DELETED',
    details: { name: column.name, boardId: column.boardId },
  });
  broadcastActivity(tenantId, activity);
  emitToTenant(tenantId, 'column:deleted', { columnId, boardId: column.boardId });
}

export async function reorderColumns(
  tenantId: string,
  organizationId: string,
  userId: string,
  boardId: string,
  orderedIds: string[],
) {
  const columns = await prisma.boardColumn.findMany({
    where: { boardId, tenantId },
    select: { id: true },
  });
  const existingIds = new Set(columns.map((column) => column.id));
  if (orderedIds.length !== columns.length || orderedIds.some((id) => !existingIds.has(id))) {
    throw ApiError.badRequest('orderedIds must contain every column of the board exactly once');
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.boardColumn.update({
        where: { id },
        data: { position: (index + 1) * POSITION_GAP },
      }),
    ),
  );

  const activity = await recordActivity(prisma, {
    tenantId,
    organizationId,
    userId,
    entityType: 'board',
    entityId: boardId,
    action: 'UPDATED',
    details: { columnsReordered: orderedIds },
  });
  broadcastActivity(tenantId, activity);
  emitToTenant(tenantId, 'column:reordered', { boardId, orderedIds });
  return listColumns(tenantId, boardId);
}
