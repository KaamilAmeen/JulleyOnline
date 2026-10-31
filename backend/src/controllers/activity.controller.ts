import type { Request, Response } from 'express';
import { listActivity } from '../services/activity.service.js';
import { getPresenceForTenant } from '../realtime/socket.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/http.js';

export const list = asyncHandler(async (req: Request, res: Response) => {
  ok(
    res,
    await listActivity(req.tenant!.id, {
      limit: (req.query.limit as number | undefined) ?? 50,
      entityType: req.query.entityType as string | undefined,
      entityId: req.query.entityId as string | undefined,
      userId: req.query.userId as string | undefined,
      boardId: req.query.boardId as string | undefined,
    }),
  );
});

export const presence = asyncHandler(async (req: Request, res: Response) => {
  ok(res, getPresenceForTenant(req.tenant!.id));
});
