import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-116';

describe('OP01-116 Artificial Devil Fruit SMILE', () => {
  it('has an OnPlay manual play from top 5 effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
