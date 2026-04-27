import { fileURLToPath } from 'node:url';
import { buildServer } from './index';

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 3001);
  const catalogPath =
    process.env.CATALOG_PATH ?? fileURLToPath(new URL('./catalog.json', import.meta.url));
  const corsOrigin = process.env.CORS_ORIGIN;

  const app = await buildServer({ catalogPath, corsOrigin });
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`server listening on :${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
