import type { Request, Response } from 'express';
import {
  createTask,
  deleteTask,
  getTask,
  getTaskActivity,
  listTasks,
  moveTask,
  updateTask,
} from '../services/task.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { noContent, ok } from '../utils/http.js';

export const list = asyncHandler(async (req: Request, res: Response) => {
  ok(
    res,
    await listTasks(req.tenant!.id, {
      boardId: req.query.boardId as string | undefined,
      columnId: req.query.columnId as string | undefined,
      assignedTo: req.query.assignedTo as string | undefined,
      search: req.query.search as string | undefined,
      overdue: req.query.overdue as boolean | undefined,
      limit: (req.query.limit as number | undefined) ?? 200,
    }),
  );
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  ok(
    res,
    await createTask(req.tenant!.id, req.tenant!.organizationId, req.user!.id, req.body),
    201,
  );
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await getTask(req.tenant!.id, req.params.id as string));
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  ok(
    res,
    await updateTask(
      req.tenant!.id,
      req.tenant!.organizationId,
      req.user!.id,
      req.params.id as string,
      req.body,
    ),
  );
});

export const move = asyncHandler(async (req: Request, res: Response) => {
  ok(
    res,
    await moveTask(
      req.tenant!.id,
      req.tenant!.organizationId,
      req.user!.id,
      req.params.id as string,
      req.body,
    ),
  );
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await deleteTask(
    req.tenant!.id,
    req.tenant!.organizationId,
    req.user!.id,
    req.tenant!.role,
    req.params.id as string,
  );
  noContent(res);
});

export const activity = asyncHandler(async (req: Request, res: Response) => {
  const limit = Number(req.query.limit ?? 50);
  ok(res, await getTaskActivity(req.tenant!.id, req.params.id as string, limit));
});
