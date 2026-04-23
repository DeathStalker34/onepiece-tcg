import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

async function main(): Promise<void> {
  const target = resolve(process.cwd(), 'apps/server/src/catalog.json');
  const cardDataDir = resolve(process.cwd(), 'packages/card-data');
  if (!existsSync(cardDataDir)) {
    throw new Error(`Expected ${cardDataDir} to exist — run from repo root`);
  }
  execSync(`corepack pnpm@9.7.0 --filter @optcg/card-data export:catalog -- ${target}`, {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
