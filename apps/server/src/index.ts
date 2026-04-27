import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketIOServer } from 'socket.io';
import { loadCatalog } from './catalog';
import { createLogger } from './logger';
import { MatchStore } from './match/store';
import { registerHandlers } from './match/handlers';

export interface ServerOptions {
  catalogPath: string;
  corsOrigin?: string;
  matchCap?: number;
  gcIntervalMs?: number;
}

export interface ServerHandle extends FastifyInstance {
  io: SocketIOServer;
  matchStore: MatchStore;
}

export async function buildServer(opts: ServerOptions): Promise<ServerHandle> {
  const logger = createLogger();
  const catalog = loadCatalog(opts.catalogPath);
  logger.info('catalog loaded', { cards: Object.keys(catalog).length });

  const app = Fastify({ logger: false });
  await app.register(cors, { origin: opts.corsOrigin ?? '*' });
  app.get('/health', async () => ({ status: 'ok' }));

  const io = new SocketIOServer(app.server, { cors: { origin: opts.corsOrigin ?? '*' } });
  const store = new MatchStore(catalog, {
    cap: opts.matchCap ?? 500,
    gcIntervalMs: opts.gcIntervalMs,
  });
  registerHandlers(io, store);

  app.addHook('onClose', async () => {
    io.close();
    store.shutdown();
  });

  const decorated = app as unknown as ServerHandle;
  decorated.io = io;
  decorated.matchStore = store;
  return decorated;
}
