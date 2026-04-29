import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-089';

describe('OP01-089 Crescent Cutlass', () => {
  it('has an OnPlay return to hand effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'returnToHand', optional: true });
  });
});
