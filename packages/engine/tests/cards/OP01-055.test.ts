import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-055';

describe('OP01-055 You Can Be My Samurai!!', () => {
  it('has an OnPlay draw 2 effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'draw', amount: 2 });
  });
});
