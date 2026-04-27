import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-064';

describe('OP01-064 Alvida', () => {
  it('has an OnAttack return to hand with DON!! x1 condition', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnAttack');
    expect(effects[0].condition).toMatchObject({ attachedDonAtLeast: 1 });
    expect(effects[0].effect).toMatchObject({ kind: 'returnToHand', optional: true });
  });
});
