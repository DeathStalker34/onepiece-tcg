import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-067';

describe('OP01-067 Crocodile', () => {
  it('has a StaticAura with DON!! x1 cost reduction effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('StaticAura');
    expect(effects[0].condition).toMatchObject({ attachedDonAtLeast: 1 });
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
