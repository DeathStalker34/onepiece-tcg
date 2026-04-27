import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-022';

describe('OP01-022 Brook', () => {
  it('has an OnAttack power debuff with DON!! x1', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnAttack');
    expect(effects[0].condition).toMatchObject({ attachedDonAtLeast: 1 });
    expect(effects[0].effect).toMatchObject({ kind: 'power', delta: -2000, optional: true });
  });
});
