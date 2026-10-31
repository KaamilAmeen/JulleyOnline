import { prisma } from '../config/prisma.js';
import { POSITION_GAP } from '../utils/position.js';
import { ApiError } from '../utils/errors.js';
import { emitToTenant } from '../realtime/bus.js';
import { ACTIVITY_USER_SELECT, broadcastActivity, recordActivity } from './activity.service.js';
import { DEFAULT_COLUMNS } from './organization.service.js';

export async function listBoards(tenantId: string) {
  return prisma.board.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
    include: {
      creator: { select: ACTIVITY_USER_SELECT },
      _count: { select: { tasks: true, columns: true } },
    },
  });
}

export async function getBoard(tenantId: string, boardId: string) {
  const board = await prisma.board.findFirst({
    where: { id: boardId, tenantId },
    include: {
      creator: { select: ACTIVITY_USER_SELECT },
      columns: { orderBy: { position: 'asc' } },
      tasks: {
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        include: {
          assignee: { select: ACTIVITY_USER_SELECT },
          creator: { select: ACTIVITY_USER_SELECT },
        },
      },
    },
  });
  if (!board) throw ApiError.notFound('Board not found');
  return board;
}

export async function assertBoardInTenant(tenantId: string, boardId: string) {
  const board = await prisma.board.findFirst({
    where: { id: boardId, tenantId },
    select: { id: true, name: true, organizationId: true, tenantId: true },
  });
  if (!board) throw ApiError.notFound('Board not found');
  return board;
}

export async function createBoard(
  tenantId: string,
  organizationId: string,
  userId: string,
  input: { name: string; description?: string | null; templateColumns?: string[] },
) {
  const columnNames = input.templateColumns?.length ? input.templateColumns : DEFAULT_COLUMNS;

  const boardId = await prisma.$transaction(async (tx) => {
    const board = await tx.board.create({
      data: {
        organizationId,
        tenantId,
        name: input.name,
        description: input.description ?? null,
        createdBy: userId,
      },
    });

    await tx.boardColumn.createMany({
      data: columnNames.map((columnName, index) => ({
        boardId: board.id,
        tenantId,
        name: columnName,
        position: (index + 1) * POSITION_GAP,
      })),
    });

    await tx.activityLog.create({
      data: {
        tenantId,
        organizationId,
        userId,
        entityType: 'board',
        entityId: board.id,
        action: 'CREATED',
        details: { name: input.name, columns: columnNames },
      },
    });

    return board.id;
  });

  const board = await getBoard(tenantId, boardId);
  emitToTenant(tenantId, 'board:created', board);
  return board;
}

export async function updateBoard(
  tenantId: string,
  organizationId: string,
  userId: string,
  boardId: string,
  input: { name?: string; description?: string | null },
) {
  const existing = await assertBoardInTenant(tenantId, boardId);

  const board = await prisma.board.update({
    where: { id: boardId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
    include: {
      creator: { select: ACTIVITY_USER_SELECT },
      columns: { orderBy: { position: 'asc' } },
      _count: { select: { tasks: true, columns: true } },
    },
  });

  const activity = await recordActivity(prisma, {
    tenantId,
    organizationId,
    userId,
    entityType: 'board',
    entityId: boardId,
    action: 'UPDATED',
    details: { from: existing.name, to: board.name },
  });
  broadcastActivity(tenantId, activity);
  emitToTenant(tenantId, 'board:updated', board);
  return board;
}

export async function deleteBoard(
  tenantId: string,
  organizationId: string,
  userId: string,
  boardId: string,
): Promise<void> {
  const board = await assertBoardInTenant(tenantId, boardId);

  await prisma.board.delete({ where: { id: boardId } });

  const activity = await recordActivity(prisma, {
    tenantId,
    organizationId,
    userId,
    entityType: 'board',
    entityId: boardId,
    action: 'DELETED',
    details: { name: board.name },
  });
  broadcastActivity(tenantId, activity);
  emitToTenant(tenantId, 'board:deleted', { boardId });
}
