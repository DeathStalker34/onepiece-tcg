import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-014';

describe('OP01-014 Jinbe', () => {
  it('has a StaticAura with DON!!x1 on block effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('StaticAura');
    expect(effects[0].condition).toMatchObject({ attachedDonAtLeast: 1 });
  });
});
