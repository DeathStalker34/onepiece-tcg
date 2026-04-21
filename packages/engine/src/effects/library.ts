import type { TriggeredEffect } from '../types/card';

/**
 * Per-card effect overrides keyed by cardId.
 *
 * Consumers (apps/web, tests, future AI code) merge this with a CardStatic
 * base to produce the final `catalog` passed to `createInitialState`.
 *
 * Fase 3 ships an empty map — the test fixtures inline their own effects.
 * Fase 7 will populate this with parsed effects for ≥70% of OP01 cards.
 */
export const CARD_EFFECT_LIBRARY: Readonly<Record<string, TriggeredEffect[]>> = Object.freeze({});

/**
 * Returns the TriggeredEffects for a given card ID, or an empty array if
 * the library has no entry. Use this when building a CardStatic from
 * external card data that lacks effect metadata.
 */
export function getEffectsForCard(cardId: string): TriggeredEffect[] {
  return CARD_EFFECT_LIBRARY[cardId] ?? [];
}
