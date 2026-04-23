import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketIOServer } from 'socket.io';
import { loadCatalog } from './catalog';
import { createLogger } from './logger';

export interface ServerOptions {
  catalogPath: string;
  corsOrigin?: string;
}

export async function buildServer(
  opts: ServerOptions,
): Promise<FastifyInstance & { io: SocketIOServer }> {
  const logger = createLogger();
  const catalog = loadCatalog(opts.catalogPath);
  logger.info('catalog loaded', { cards: Object.keys(catalog).length });

  const app = Fastify({ logger: false });
  await app.register(cors, { origin: opts.corsOrigin ?? '*' });

  app.get('/health', async () => ({ status: 'ok' }));

  const io = new SocketIOServer(app.server, {
    cors: { origin: opts.corsOrigin ?? '*' },
  });

  const decorated = app as FastifyInstance & { io: SocketIOServer };
  decorated.io = io;
  return decorated;
}

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 3001);
  const catalogPath =
    process.env.CATALOG_PATH ?? new URL('./catalog.json', import.meta.url).pathname;
  const corsOrigin = process.env.CORS_ORIGIN;

  const app = await buildServer({ catalogPath, corsOrigin });
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`server listening on :${port}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
