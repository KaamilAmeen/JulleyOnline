import type { Server } from 'socket.io';

let io: Server | null = null;

export function setIO(server: Server): void {
  io = server;
}

export function getIO(): Server | null {
  return io;
}

export type RealtimeEvent =
  | 'task:created'
  | 'task:updated'
  | 'task:moved'
  | 'task:deleted'
  | 'board:created'
  | 'board:updated'
  | 'board:deleted'
  | 'column:created'
  | 'column:updated'
  | 'column:deleted'
  | 'column:reordered'
  | 'activity:created'
  | 'presence:online'
  | 'presence:offline'
  | 'presence:update';

/** Every realtime event is scoped to one tenant room. */
export function emitToTenant(tenantId: string, event: RealtimeEvent, payload: unknown): void {
  io?.to(`tenant:${tenantId}`).emit(event, payload);
}

/** Sends an event to every socket owned by one user (used for conflict notices). */
export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}
