import type { Request, Response } from 'express';
import { askAssistant } from '../services/ai.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/http.js';

export const query = asyncHandler(async (req: Request, res: Response) => {
  ok(
    res,
    await askAssistant(
      {
        tenantId: req.tenant!.id,
        tenantName: req.tenant!.name,
        userId: req.user!.id,
        userName: req.user!.name,
        role: req.tenant!.role,
      },
      req.body.question,
    ),
  );
});
