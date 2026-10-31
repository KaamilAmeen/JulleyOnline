import crypto from 'node:crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from './errors.js';

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  email: string;
  name: string;
  type: 'access';
}

export function signAccessToken(user: { id: string; email: string; name: string }): string {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, type: 'access' },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.ACCESS_TOKEN_TTL_SECONDS, issuer: 'kanban-api' },
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'kanban-api' });
    if (typeof payload === 'string' || payload.type !== 'access' || !payload.sub) {
      throw new Error('Malformed token');
    }
    return payload as AccessTokenPayload;
  } catch {
    throw ApiError.unauthorized('Session expired. Please sign in again.');
  }
}

/** Refresh tokens are opaque random strings; only their hash is stored. */
export function createRefreshToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(48).toString('base64url');
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Verifies a refresh token signature when used as a JWT (not used for rotation). */
export function verifyRefreshToken(token: string): { sub: string } {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET);
    if (typeof payload === 'string' || !payload.sub) throw new Error('Malformed token');
    return { sub: payload.sub };
  } catch {
    throw ApiError.unauthorized('Invalid refresh token');
  }
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}
