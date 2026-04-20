import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { CardDataService } from './service';
import type { DomainCard } from './types';

export interface SyncRow {
  id: string;
  setId: string;
  setName: string;
  name: string;
  rarity: string;
  type: string;
  cost: number | null;
  power: number | null;
  counter: number | null;
  life: number | null;
  colors: string;
  attributes: string;
  effectText: string;
  triggerText: string | null;
  imagePath: string;
  sourceUrl: string;
}

export interface SyncOptions {
  sets: string[];
  service: CardDataService;
  imagesDir: string;
  upsertCard: (row: SyncRow) => Promise<void>;
  downloadImage: (url: string, dest: string) => Promise<void>;
  forceImages: boolean;
}

export interface SyncSummary {
  upserted: number;
  imagesDownloaded: number;
  imagesSkipped: number;
  failures: number;
}

function toRow(card: DomainCard, imagePath: string): SyncRow {
  return {
    id: card.id,
    setId: card.setId,
    setName: card.setName,
    name: card.name,
    rarity: card.rarity,
    type: card.type,
    cost: card.cost,
    power: card.power,
    counter: card.counter,
    life: card.life,
    colors: card.colors.join(','),
    attributes: card.attributes.join(','),
    effectText: card.effectText,
    triggerText: card.triggerText,
    imagePath,
    sourceUrl: card.sourceImageUrl,
  };
}

export async function runSync(opts: SyncOptions): Promise<SyncSummary> {
  const summary: SyncSummary = {
    upserted: 0,
    imagesDownloaded: 0,
    imagesSkipped: 0,
    failures: 0,
  };

  for (const setId of opts.sets) {
    const cards = await opts.service.listCardsInSet(setId);
    for (const card of cards) {
      const imagePath = `/cards/${card.setId}/${card.id}.webp`;
      const absImage = join(opts.imagesDir, card.setId, `${card.id}.webp`);

      if (!existsSync(absImage) || opts.forceImages) {
        try {
          await opts.downloadImage(card.sourceImageUrl, absImage);
          summary.imagesDownloaded += 1;
        } catch (err) {
          console.warn(`[${card.id}] image download failed: ${(err as Error).message}`);
          summary.failures += 1;
          continue;
        }
      } else {
        summary.imagesSkipped += 1;
      }

      await opts.upsertCard(toRow(card, imagePath));
      summary.upserted += 1;
    }
  }

  return summary;
}
