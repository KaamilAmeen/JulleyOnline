import type { Prisma, PrismaClient } from '@prisma/client';
import { ACCESS_COOKIE } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { resolveTenantMembership } from '../middleware/tenant.js';
import { ApiError } from '../utils/errors.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { emitToTenant } from './bus.js';
import { addPresence, listPresence, removePresence } from './presence.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key === name) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return undefined;
}

interface SocketUser {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
}

declare module 'socket.io' {
  interface SocketData {
    user: SocketUser;
    tenantId?: string;
  }
}

interface JoinAck {
  ok: boolean;
  error?: string;
  role?: string;
  tenantId?: string;
  presence?: ReturnType<typeof listPresence>;
}

export function registerSocketHandlers(io: import('socket.io').Server): void {
  io.use(async (socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        readCookie(socket.handshake.headers.cookie, ACCESS_COOKIE);
      if (!token) return next(new Error('UNAUTHORIZED'));

      const payload = verifyAccessToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true, email: true, avatarColor: true },
      });
      if (!user) return next(new Error('UNAUTHORIZED'));

      socket.data.user = user;
      return next();
    } catch {
      return next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    void socket.join(`user:${user.id}`);

    socket.on('tenant:join', async (payload: { tenantId?: string } | string, ack?: (response: JoinAck) => void) => {
      try {
        const tenantId = typeof payload === 'string' ? payload : payload?.tenantId;
        if (!tenantId || !UUID_RE.test(tenantId)) {
          ack?.({ ok: false, error: 'INVALID_TENANT' });
          return;
        }

        // The server — never the client — decides which rooms a socket may join.
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { id: true, organizationId: true },
        });
        if (!tenant) {
          ack?.({ ok: false, error: 'TENANT_NOT_FOUND' });
          return;
        }
        const membership = await resolveTenantMembership(user.id, tenant);
        if (!membership) {
          ack?.({ ok: false, error: 'FORBIDDEN' });
          return;
        }

        // Leave any previously joined tenant room before joining the new one.
        for (const room of socket.rooms) {
          if (room.startsWith('tenant:') && room !== `tenant:${tenantId}`) {
            const previousTenant = room.slice('tenant:'.length);
            await socket.leave(room);
            const wentOffline = removePresence(previousTenant, user.id, socket.id);
            emitToTenant(previousTenant, 'presence:update', {
              tenantId: previousTenant,
              users: listPresence(previousTenant),
            });
            if (wentOffline) {
              emitToTenant(previousTenant, 'presence:offline', { tenantId: previousTenant, userId: user.id });
            }
          }
        }

        const previousPresence = listPresence(tenantId).find((entry) => entry.userId === user.id);
        await socket.join(`tenant:${tenantId}`);
        socket.data.tenantId = tenantId;

        const presence = addPresence(tenantId, user, socket.id);
        emitToTenant(tenantId, 'presence:update', { tenantId, users: presence });
        if (!previousPresence) {
          emitToTenant(tenantId, 'presence:online', {
            tenantId,
            user: { userId: user.id, name: user.name, avatarColor: user.avatarColor },
          });
        }

        ack?.({ ok: true, role: membership.role, tenantId, presence });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[socket tenant:join]', error);
        ack?.({ ok: false, error: 'INTERNAL_ERROR' });
      }
    });

    socket.on('tenant:leave', async (payload: { tenantId?: string } | undefined, ack?: (response: JoinAck) => void) => {
      const tenantId = payload?.tenantId ?? socket.data.tenantId;
      if (!tenantId) return ack?.({ ok: false, error: 'INVALID_TENANT' });
      await socket.leave(`tenant:${tenantId}`);
      const wentOffline = removePresence(tenantId, user.id, socket.id);
      emitToTenant(tenantId, 'presence:update', { tenantId, users: listPresence(tenantId) });
      if (wentOffline) emitToTenant(tenantId, 'presence:offline', { tenantId, userId: user.id });
      socket.data.tenantId = undefined;
      ack?.({ ok: true, tenantId });
    });

    socket.on('presence:heartbeat', (ack?: (response: { ok: boolean }) => void) => {
      const tenantId = socket.data.tenantId;
      if (tenantId) addPresence(tenantId, user, socket.id);
      ack?.({ ok: true });
    });

    socket.on('disconnect', () => {
      const tenantId = socket.data.tenantId;
      if (!tenantId) return;
      const wentOffline = removePresence(tenantId, user.id, socket.id);
      emitToTenant(tenantId, 'presence:update', { tenantId, users: listPresence(tenantId) });
      if (wentOffline) emitToTenant(tenantId, 'presence:offline', { tenantId, userId: user.id });
    });
  });
}

export function getPresenceForTenant(tenantId: string) {
  return listPresence(tenantId);
}

export type { Prisma, PrismaClient };
