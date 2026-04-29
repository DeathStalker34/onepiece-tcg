import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-025';

describe('OP01-025 Roronoa Zoro', () => {
  it('has a StaticAura Rush keyword effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('StaticAura');
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
