import { describe, it, expect } from 'vitest';
import { CARD_EFFECT_LIBRARY } from '../../src/effects/library';

const OP01_TOTAL = 121;
const REQUIRED = 85;

describe('OP01 library coverage', () => {
  it(`has at least ${REQUIRED} OP01 cards with effects`, () => {
    const op01Covered = Object.entries(CARD_EFFECT_LIBRARY).filter(
      ([id, fx]) => id.startsWith('OP01-') && fx.length > 0,
    ).length;
    console.log(`OP01 coverage: ${op01Covered}/${OP01_TOTAL}`);
    expect(op01Covered).toBeGreaterThanOrEqual(REQUIRED);
  });
});
