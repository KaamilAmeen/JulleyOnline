import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { ACCESS_COOKIE } from '../config/env.js';
import { ApiError } from '../utils/errors.js';
import { verifyAccessToken } from '../utils/tokens.js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function extractAccessToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
  return cookieToken ?? null;
}

/** Authenticates the request from the access cookie (browser) or Bearer token (Postman). */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractAccessToken(req);
    if (!token) throw ApiError.unauthorized();

    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, avatarColor: true },
    });
    if (!user) throw ApiError.unauthorized('Account no longer exists');

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function currentUser(req: Request): AuthUser {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
}
