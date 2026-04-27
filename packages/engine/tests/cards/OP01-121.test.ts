import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-121';

describe('OP01-121 Yamato', () => {
  it('has a StaticAura name alias effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('StaticAura');
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
