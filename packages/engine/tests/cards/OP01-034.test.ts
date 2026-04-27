import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-034';

describe('OP01-034 Inuarashi', () => {
  it('has an OnAttack manual effect with DON!! x2 condition', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnAttack');
    expect(effects[0].condition).toMatchObject({ attachedDonAtLeast: 2 });
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
