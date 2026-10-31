import type { Response } from 'express';
import { ACCESS_COOKIE, REFRESH_COOKIE, env } from '../config/env.js';

const baseCookie = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.cookieSecure,
  domain: env.COOKIE_DOMAIN,
};

export function setSessionCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseCookie,
    path: '/',
    maxAge: env.ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookie,
    path: '/api/auth',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookie, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...baseCookie, path: '/api/auth' });
}
