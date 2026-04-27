import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-084';

describe('OP01-084 Mr.2.Bon.Kurei(Bentham)', () => {
  it('has an OnAttack search from deck with DON!! x1', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnAttack');
    expect(effects[0].condition).toMatchObject({ attachedDonAtLeast: 1 });
    expect(effects[0].effect).toMatchObject({ kind: 'search', from: 'deck' });
  });
});
