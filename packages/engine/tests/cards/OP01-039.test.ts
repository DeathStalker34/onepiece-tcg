import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-039';

describe('OP01-039 Killer', () => {
  it('has a StaticAura with DON!! x1 on block draw effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('StaticAura');
    expect(effects[0].condition).toMatchObject({ attachedDonAtLeast: 1 });
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
