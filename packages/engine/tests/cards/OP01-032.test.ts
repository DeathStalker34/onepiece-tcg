import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-032';

describe('OP01-032 Ashura Doji', () => {
  it('has a StaticAura power buff with DON!! x1 condition', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('StaticAura');
    expect(effects[0].condition).toMatchObject({ attachedDonAtLeast: 1 });
    expect(effects[0].effect).toMatchObject({ kind: 'power', delta: 2000 });
  });
});
