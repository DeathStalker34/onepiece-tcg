import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

async function main(): Promise<void> {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(scriptDir, '../../..');
  const target = resolve(repoRoot, 'apps/server/src/catalog.json');
  const cardDataDir = resolve(repoRoot, 'packages/card-data');
  if (!existsSync(cardDataDir)) {
    throw new Error(`Expected ${cardDataDir} to exist`);
  }
  execSync(`corepack pnpm@9.7.0 --filter @optcg/card-data export:catalog -- ${target}`, {
    stdio: 'inherit',
    cwd: repoRoot,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
