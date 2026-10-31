import type { Request, Response } from 'express';
import {
  createColumn,
  deleteColumn,
  listColumns,
  reorderColumns,
  updateColumn,
} from '../services/column.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { noContent, ok } from '../utils/http.js';

export const listForBoard = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await listColumns(req.tenant!.id, req.params.id as string));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  ok(
    res,
    await createColumn(
      req.tenant!.id,
      req.tenant!.organizationId,
      req.user!.id,
      req.params.id as string,
      req.body.name,
    ),
    201,
  );
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  ok(
    res,
    await updateColumn(
      req.tenant!.id,
      req.tenant!.organizationId,
      req.user!.id,
      req.params.id as string,
      req.body.name,
    ),
  );
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await deleteColumn(req.tenant!.id, req.tenant!.organizationId, req.user!.id, req.params.id as string);
  noContent(res);
});

export const reorder = asyncHandler(async (req: Request, res: Response) => {
  ok(
    res,
    await reorderColumns(
      req.tenant!.id,
      req.tenant!.organizationId,
      req.user!.id,
      req.body.boardId,
      req.body.orderedIds,
    ),
  );
});
