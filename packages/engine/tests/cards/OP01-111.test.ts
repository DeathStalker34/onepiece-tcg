import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-111';

describe('OP01-111 Black Maria', () => {
  it('has a StaticAura on block power buff effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('StaticAura');
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
