import type { Response } from 'express';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/errors.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { clearSessionCookies, setSessionCookies } from '../utils/cookies.js';
import { createRefreshToken, hashRefreshToken, refreshTokenExpiry, signAccessToken } from '../utils/tokens.js';

const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarColor: true,
  createdAt: true,
} as const;

type PublicUser = {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  createdAt: Date;
};

/** Creates a refresh-token row and sets both auth cookies. */
async function issueSession(user: PublicUser, res: Response): Promise<string> {
  const accessToken = signAccessToken(user);
  const refresh = createRefreshToken();

  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: refresh.hash, expiresAt: refreshTokenExpiry() },
  });

  setSessionCookies(res, accessToken, refresh.token);
  return accessToken;
}

export async function registerUser(
  input: { name: string; email: string; password: string },
  res: Response,
) {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists');

  const palette = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6'];
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      avatarColor: palette[Math.floor(Math.random() * palette.length)]!,
    },
    select: PUBLIC_USER_SELECT,
  });

  await issueSession(user, res);
  return { user, memberships: [] };
}

export async function loginUser(input: { email: string; password: string }, res: Response) {
  const account = await prisma.user.findUnique({
    where: { email: input.email },
    select: { ...PUBLIC_USER_SELECT, passwordHash: true },
  });

  // Same generic error for unknown email and wrong password (no account enumeration).
  if (!account || !(await verifyPassword(input.password, account.passwordHash))) {
    throw ApiError.unauthorized('Incorrect email or password');
  }

  const { passwordHash: _passwordHash, ...user } = account;
  await issueSession(user, res);
  return { user, memberships: await listMemberships(user.id) };
}

export async function rotateSession(rawToken: string | undefined, res: Response) {
  if (!rawToken) throw ApiError.unauthorized('No refresh token provided');

  const tokenHash = hashRefreshToken(rawToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { select: PUBLIC_USER_SELECT } },
  });

  if (!stored) {
    clearSessionCookies(res);
    throw ApiError.unauthorized('Invalid refresh token');
  }

  if (stored.revokedAt) {
    // Reuse of a rotated token: assume compromise and revoke every session.
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    clearSessionCookies(res);
    throw ApiError.unauthorized('Refresh token was already used. Please sign in again.');
  }

  if (stored.expiresAt.getTime() <= Date.now()) {
    clearSessionCookies(res);
    throw ApiError.unauthorized('Refresh token expired');
  }

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  await issueSession(stored.user, res);
  return { user: stored.user, memberships: await listMemberships(stored.userId) };
}

export async function logoutUser(rawToken: string | undefined, res: Response): Promise<void> {
  if (rawToken) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashRefreshToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  clearSessionCookies(res);
}

export async function listMemberships(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      role: true,
      organizationId: true,
      tenantId: true,
      organization: { select: { id: true, name: true, slug: true } },
      tenant: { select: { id: true, name: true, slug: true } },
    },
  });
  return memberships;
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: PUBLIC_USER_SELECT });
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  return { user, memberships: await listMemberships(userId) };
}

export async function updateProfile(
  userId: string,
  input: { name?: string; avatarColor?: string },
) {
  return prisma.user.update({
    where: { id: userId },
    data: input,
    select: PUBLIC_USER_SELECT,
  });
}
