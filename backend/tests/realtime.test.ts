import http from 'node:http';
import { Server } from 'socket.io';
import { io as connectClient, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { setIO } from '../src/realtime/bus.js';
import { registerSocketHandlers } from '../src/realtime/socket.js';
import {
  createBoard,
  createOrganization,
  createTask,
  login,
  newAgent,
  register,
  cookieValue,
} from './helpers.js';

let httpServer: http.Server;
let ioServer: Server;
let baseUrl: string;

beforeAll(async () => {
  httpServer = http.createServer(app);
  ioServer = new Server(httpServer, { cors: { origin: '*' } });
  setIO(ioServer);
  registerSocketHandlers(ioServer);
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => ioServer.close(() => resolve()));
});

function connect(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = connectClient(baseUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    });
    const timer = setTimeout(() => reject(new Error('socket connect timeout')), 5000);
    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function emitAck<T>(socket: Socket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} ack timeout`)), 5000);
    socket.emit(event, payload, (response: T) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

function nextEvent<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} timeout`)), 5000);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function fixture() {
  const owner = newAgent();
  await register(owner, 'Rahul Sharma', 'rahul@abctech.dev');
  const org = await createOrganization(owner, 'ABC Technologies');
  const tenantId = org.tenants[0]!.id;
  const board = await createBoard(owner, tenantId, 'Platform Roadmap');

  const loginRes = await login(owner, 'rahul@abctech.dev');
  const token = cookieValue(loginRes, 'kanban_access');
  if (!token) throw new Error('missing access cookie');

  return { owner, token, tenantId, board };
}

describe('socket.io realtime', () => {
  it('rejects connections without a valid access token', async () => {
    await expect(connect('not-a-jwt')).rejects.toThrow();
  });

  it('only joins a tenant room after a membership check', async () => {
    const { owner, token, tenantId, board } = await fixture();
    const ownerSocket = await connect(token);
    const outsider = newAgent();
    await register(outsider, 'Meera Joshi', 'meera@xyzsolutions.dev');
    await createOrganization(outsider, 'XYZ Solutions');
    const outsiderLogin = await login(outsider, 'meera@xyzsolutions.dev');
    const outsiderSocket = await connect(cookieValue(outsiderLogin, 'kanban_access')!);

    try {
      const ack = await emitAck<{ ok: boolean; role: string; presence: unknown[] }>(ownerSocket, 'tenant:join', {
        tenantId,
      });
      expect(ack.ok).toBe(true);
      expect(ack.role).toBe('ORG_ADMIN');
      expect(Array.isArray(ack.presence)).toBe(true);

      const denied = await emitAck<{ ok: boolean; error: string }>(outsiderSocket, 'tenant:join', { tenantId });
      expect(denied.ok).toBe(false);
      expect(denied.error).toBe('FORBIDDEN');

      // The owner still receives live events for that tenant.
      const created = nextEvent<{ id: string; title: string; tenantId: string }>(ownerSocket, 'task:created');
      const task = await createTask(owner, tenantId, board.id, board.columns[0]!.id, 'Realtime task');
      const event = await created;
      expect(event.id).toBe(task.id);
      expect(event.title).toBe('Realtime task');
      expect(event.tenantId).toBe(tenantId);
    } finally {
      ownerSocket.disconnect();
      outsiderSocket.disconnect();
    }
  });

  it('broadcasts presence to everyone in the tenant room', async () => {
    const { owner, token, tenantId } = await fixture();

    const first = await connect(token);
    await emitAck(first, 'tenant:join', { tenantId });

    const second = await connect(token);
    const presenceEvent = nextEvent<{ tenantId: string; users: { userId: string; connections: number }[] }>(
      first,
      'presence:update',
    );
    await emitAck(second, 'tenant:join', { tenantId });

    const presence = await presenceEvent;
    expect(presence.tenantId).toBe(tenantId);
    expect(presence.users[0]?.connections).toBe(2);

    first.disconnect();
    second.disconnect();
    expect(owner).toBeTruthy();
  });
});
