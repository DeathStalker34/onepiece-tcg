import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-078';

describe('OP01-078 Boa Hancock', () => {
  it('has an OnAttack draw effect with DON!! x1 condition', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnAttack');
    expect(effects[0].condition).toMatchObject({ attachedDonAtLeast: 1 });
    expect(effects[0].effect).toMatchObject({ kind: 'draw', amount: 1 });
  });
});
