import { describe, expect, it } from 'vitest';
import { CARD_EFFECT_LIBRARY, getEffectsForCard } from '../src/effects/library';

describe('CARD_EFFECT_LIBRARY', () => {
  it('is frozen so consumers cannot mutate it accidentally', () => {
    expect(Object.isFrozen(CARD_EFFECT_LIBRARY)).toBe(true);
  });

  it('getEffectsForCard returns empty array for unknown IDs', () => {
    expect(getEffectsForCard('NON-EXISTENT-ID')).toEqual([]);
  });
});
