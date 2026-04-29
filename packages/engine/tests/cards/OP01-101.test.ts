import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-101';

describe('OP01-101 Sasaki', () => {
  it('has an OnAttack manual DON!! add effect with DON!! x1', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnAttack');
    expect(effects[0].condition).toMatchObject({ attachedDonAtLeast: 1 });
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
