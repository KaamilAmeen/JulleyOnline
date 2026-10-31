import type { Request, Response } from 'express';
import {
  createBoard,
  deleteBoard,
  getBoard,
  listBoards,
  updateBoard,
} from '../services/board.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { noContent, ok } from '../utils/http.js';

export const list = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await listBoards(req.tenant!.id));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  ok(
    res,
    await createBoard(req.tenant!.id, req.tenant!.organizationId, req.user!.id, req.body),
    201,
  );
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await getBoard(req.tenant!.id, req.params.id as string));
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  ok(
    res,
    await updateBoard(
      req.tenant!.id,
      req.tenant!.organizationId,
      req.user!.id,
      req.params.id as string,
      req.body,
    ),
  );
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await deleteBoard(req.tenant!.id, req.tenant!.organizationId, req.user!.id, req.params.id as string);
  noContent(res);
});
