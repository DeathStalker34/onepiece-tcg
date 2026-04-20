import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CardDataService } from '../src/service';
import type { DomainCard } from '../src/types';
import { runSync } from '../src/sync-runner';

const mockCards: DomainCard[] = [
  {
    id: 'OP01-001',
    setId: 'OP01',
    setName: 'Romance Dawn',
    name: 'Zoro',
    rarity: 'L',
    type: 'LEADER',
    cost: null,
    power: 5000,
    counter: null,
    life: 4,
    colors: ['Green'],
    attributes: ['Straw Hat Crew'],
    effectText: '',
    triggerText: null,
    sourceImageUrl: 'https://x/op01-001.png',
  },
  {
    id: 'OP01-013',
    setId: 'OP01',
    setName: 'Romance Dawn',
    name: 'Usopp',
    rarity: 'C',
    type: 'CHARACTER',
    cost: 1,
    power: 2000,
    counter: 1000,
    life: null,
    colors: ['Green'],
    attributes: ['Straw Hat Crew'],
    effectText: '',
    triggerText: 'Draw 1 card.',
    sourceImageUrl: 'https://x/op01-013.png',
  },
];

class FakeService implements CardDataService {
  constructor(private readonly cards: DomainCard[]) {}
  async listCardsInSet(_setId: string): Promise<DomainCard[]> {
    return this.cards;
  }
  imageUrlFor(card: DomainCard): string {
    return card.sourceImageUrl;
  }
}

describe('runSync', () => {
  let imagesDir: string;
  const writes: Array<{ id: string; imagePath: string }> = [];
  const downloadedUrls: string[] = [];

  const upsert = vi.fn(async (row: { id: string; imagePath: string }) => {
    writes.push(row);
  });

  const downloader = vi.fn(async (url: string, _path: string) => {
    downloadedUrls.push(url);
  });

  beforeEach(() => {
    imagesDir = mkdtempSync(join(tmpdir(), 'sync-'));
    writes.length = 0;
    downloadedUrls.length = 0;
    upsert.mockClear();
    downloader.mockClear();
  });

  afterEach(() => {
    rmSync(imagesDir, { recursive: true, force: true });
  });

  it('upserts every card and downloads every image on first run', async () => {
    const summary = await runSync({
      sets: ['OP01'],
      service: new FakeService(mockCards),
      imagesDir,
      upsertCard: upsert,
      downloadImage: downloader,
      forceImages: false,
    });

    expect(writes).toHaveLength(2);
    expect(downloadedUrls).toHaveLength(2);
    expect(summary.upserted).toBe(2);
    expect(summary.imagesDownloaded).toBe(2);
    expect(summary.imagesSkipped).toBe(0);
    expect(summary.failures).toBe(0);
  });

  it('skips existing images on second run', async () => {
    await runSync({
      sets: ['OP01'],
      service: new FakeService(mockCards),
      imagesDir,
      upsertCard: upsert,
      downloadImage: async (_url, path) => {
        const { writeFileSync } = await import('node:fs');
        const { dirname } = await import('node:path');
        const { mkdirSync } = await import('node:fs');
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, 'pretend-webp');
      },
      forceImages: false,
    });

    const secondRun = await runSync({
      sets: ['OP01'],
      service: new FakeService(mockCards),
      imagesDir,
      upsertCard: upsert,
      downloadImage: downloader,
      forceImages: false,
    });

    expect(secondRun.imagesDownloaded).toBe(0);
    expect(secondRun.imagesSkipped).toBe(2);
    expect(secondRun.upserted).toBe(2);
  });

  it('logs-and-continues when an image download fails', async () => {
    const summary = await runSync({
      sets: ['OP01'],
      service: new FakeService(mockCards),
      imagesDir,
      upsertCard: upsert,
      downloadImage: vi.fn(async () => {
        throw new Error('boom');
      }),
      forceImages: false,
    });

    expect(summary.failures).toBe(2);
    expect(summary.upserted).toBe(0);
  });

  it('writes imagePath relative to /cards', async () => {
    await runSync({
      sets: ['OP01'],
      service: new FakeService(mockCards),
      imagesDir,
      upsertCard: upsert,
      downloadImage: downloader,
      forceImages: false,
    });
    expect(writes[0].imagePath).toBe('/cards/OP01/OP01-001.webp');
  });
});
