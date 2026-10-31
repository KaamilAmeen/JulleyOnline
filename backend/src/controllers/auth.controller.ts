import type { Request, Response } from 'express';
import { REFRESH_COOKIE } from '../config/env.js';
import {
  getProfile,
  loginUser,
  logoutUser,
  registerUser,
  rotateSession,
  updateProfile,
} from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/http.js';

export const register = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await registerUser(req.body, res), 201);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await loginUser(req.body, res));
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
  ok(res, await rotateSession(token, res));
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
  await logoutUser(token, res);
  ok(res, { success: true });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await getProfile(req.user!.id));
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await updateProfile(req.user!.id, req.body));
});
