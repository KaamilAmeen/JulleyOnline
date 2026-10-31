import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/errors.js';

export interface AssistantContext {
  tenantId: string;
  tenantName: string;
  userId: string;
  userName: string;
  role: string;
}

/**
 * Builds a tenant-scoped snapshot and forwards it to the Python AI service.
 * The AI service never receives database credentials and can only reason over
 * data the authenticated user is already allowed to see.
 */
export async function askAssistant(context: AssistantContext, question: string) {
  const [boards, activity] = await Promise.all([
    prisma.board.findMany({
      where: { tenantId: context.tenantId },
      orderBy: { name: 'asc' },
      include: {
        columns: { orderBy: { position: 'asc' }, select: { id: true, name: true, position: true } },
        tasks: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            priority: true,
            dueDate: true,
            columnId: true,
            createdAt: true,
            updatedAt: true,
            version: true,
            assignee: { select: { name: true } },
          },
        },
      },
    }),
    prisma.activityLog.findMany({
      where: { tenantId: context.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        action: true,
        entityType: true,
        details: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
  ]);

  const snapshot = boards.map((board) => ({
    id: board.id,
    name: board.name,
    description: board.description,
    columns: board.columns,
    tasks: board.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueDate: task.dueDate,
      columnId: task.columnId,
      columnName: board.columns.find((column) => column.id === task.columnId)?.name ?? 'Unknown',
      assignee: task.assignee?.name ?? null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      version: task.version,
    })),
  }));

  let response: globalThis.Response;
  try {
    response = await fetch(`${env.AI_SERVICE_URL}/assistant/query`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-service-token': env.AI_SERVICE_TOKEN,
      },
      body: JSON.stringify({
        question,
        context: {
          ...context,
          now: new Date().toISOString(),
          boards: snapshot,
          activity: activity.map((entry) => ({
            action: entry.action,
            entityType: entry.entityType,
            details: entry.details,
            createdAt: entry.createdAt,
            userName: entry.user.name,
          })),
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new ApiError(
      503,
      'AI_SERVICE_UNAVAILABLE',
      'The AI assistant is not running. Start the ai-service and try again.',
    );
  }

  if (!response.ok) {
    throw new ApiError(502, 'AI_SERVICE_ERROR', `The AI service returned ${response.status}`);
  }

  const result = (await response.json()) as {
    answer: string;
    toolsUsed: string[];
    provider: string;
    model?: string;
  };

  return { ...result, generatedAt: new Date().toISOString() };
}
