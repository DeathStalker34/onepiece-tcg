import 'dotenv/config';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApitcgAdapter } from '../src/index';
import { prisma } from '../src/prisma';
import { runSync, type SyncRow } from '../src/sync-runner';
import { downloadAndEncodeWebp } from '../src/images';
import type { CardDataService } from '../src/service';
import type { DomainCard } from '../src/types';

const DEFAULT_SETS = ['OP01', 'OP02'];
const BACKOFF_MS = [1000, 4000, 10000];

function parseArgs(): { sets: string[]; forceImages: boolean } {
  const argv = process.argv.slice(2);
  let sets = DEFAULT_SETS;
  let forceImages = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--sets' && argv[i + 1]) {
      sets = argv[i + 1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      i += 1;
    } else if (argv[i] === '--force-images') {
      forceImages = true;
    }
  }
  return { sets, forceImages };
}

function resolvePublicCardsDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // packages/card-data/scripts -> apps/web/public/cards
  const candidate = resolve(here, '..', '..', '..', 'apps', 'web', 'public', 'cards');
  if (!existsSync(resolve(candidate, '..'))) {
    throw new Error(`cannot locate apps/web/public (looked at ${candidate})`);
  }
  return candidate;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Wraps a CardDataService so that listCardsInSet retries with backoff.
 * imageUrlFor is a pure function — passed through unchanged.
 */
function withRetry(service: CardDataService): CardDataService {
  return {
    async listCardsInSet(setId: string): Promise<DomainCard[]> {
      let lastErr: unknown;
      for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt += 1) {
        try {
          return await service.listCardsInSet(setId);
        } catch (err) {
          lastErr = err;
          if (attempt === BACKOFF_MS.length) break;
          const wait = BACKOFF_MS[attempt];
          console.warn(
            `[sync] ${setId} attempt ${attempt + 1} failed: ${(err as Error).message} — retrying in ${wait}ms`,
          );
          await sleep(wait);
        }
      }
      throw lastErr;
    },
    imageUrlFor: service.imageUrlFor.bind(service),
  };
}

async function main(): Promise<void> {
  const { sets, forceImages } = parseArgs();
  const imagesDir = resolvePublicCardsDir();
  const service = withRetry(new ApitcgAdapter({ apiKey: process.env.APITCG_KEY }));

  console.log(`[sync] sets=${sets.join(',')} forceImages=${forceImages}`);
  console.log(`[sync] imagesDir=${imagesDir}`);

  const summary = await runSync({
    sets,
    service,
    imagesDir,
    upsertCard: async (row: SyncRow) => {
      await prisma.card.upsert({ where: { id: row.id }, create: row, update: row });
    },
    downloadImage: downloadAndEncodeWebp,
    forceImages,
  });

  console.log(
    `[sync] done — upserted=${summary.upserted} imagesDownloaded=${summary.imagesDownloaded} imagesSkipped=${summary.imagesSkipped} failures=${summary.failures}`,
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('[sync] fatal:', err);
  await prisma.$disconnect();
  process.exit(1);
});
