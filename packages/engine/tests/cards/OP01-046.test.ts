import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-046';

describe('OP01-046 Denjiro', () => {
  it('has an OnAttack manual effect with DON!! x1 condition', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnAttack');
    expect(effects[0].condition).toMatchObject({ attachedDonAtLeast: 1 });
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
