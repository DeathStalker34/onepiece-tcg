import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-095';

describe('OP01-095 Kyoshirou', () => {
  it('has an OnPlay manual conditional draw effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
