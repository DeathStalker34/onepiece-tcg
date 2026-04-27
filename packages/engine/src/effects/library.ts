import type { TriggeredEffect } from '../types/card';
import { effects as OP01_001 } from './cards/OP01-001';

/**
 * Per-card effect overrides keyed by cardId.
 * Hand-coded library — see helpers.ts for terse constructors.
 */
export const CARD_EFFECT_LIBRARY: Readonly<Record<string, TriggeredEffect[]>> = Object.freeze({
  'OP01-001': OP01_001,
});

export function getEffectsForCard(cardId: string): TriggeredEffect[] {
  return CARD_EFFECT_LIBRARY[cardId] ?? [];
}
