import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-080';

describe('OP01-080 Miss Doublefinger(Zala)', () => {
  it('has an OnKO draw 1 effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnKO');
    expect(effects[0].effect).toMatchObject({ kind: 'draw', amount: 1 });
  });
});
