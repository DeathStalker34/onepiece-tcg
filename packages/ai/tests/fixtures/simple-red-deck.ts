import { TEST_CATALOG } from './test-cards';
import type { CardStatic } from '@optcg/engine';

/** 50 card IDs forming a legal Red deck: uses non-leader cards, max 4 copies. */
export function simpleRedDeck50(): string[] {
  const ids: string[] = [];
  // Cycle through 13 playable cards (characters + events + stages), 4 of each = 52; trim to 50.
  const pool = Object.values(TEST_CATALOG)
    .filter((c) => c.type !== 'LEADER')
    .map((c) => c.id);
  // Repeat each ID 4 times, take 50.
  for (const id of pool) {
    for (let i = 0; i < 4; i += 1) {
      ids.push(id);
      if (ids.length === 50) return ids;
    }
  }
  // Fallback if pool < 13 cards:
  while (ids.length < 50) {
    ids.push(pool[ids.length % pool.length]);
  }
  return ids;
}

/** Builds a catalog merged with a single leader for a test MatchSetup. */
export function buildCatalog(): Record<string, CardStatic> {
  return { ...TEST_CATALOG };
}
