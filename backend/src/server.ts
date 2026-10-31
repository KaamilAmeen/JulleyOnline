import http from 'node:http';
import { Server } from 'socket.io';
import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { setIO } from './realtime/bus.js';
import { registerSocketHandlers } from './realtime/socket.js';

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: env.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST'],
  },
  pingInterval: 20_000,
  pingTimeout: 25_000,
  maxHttpBufferSize: 1_000_000,
});

setIO(io);
registerSocketHandlers(io);

httpServer.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[kanban-api] listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  // eslint-disable-next-line no-console
  console.log(`[kanban-api] allowed origins: ${env.corsOrigins.join(', ')}`);
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  // eslint-disable-next-line no-console
  console.log(`[kanban-api] ${signal} received, shutting down`);

  io.close();
  httpServer.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
