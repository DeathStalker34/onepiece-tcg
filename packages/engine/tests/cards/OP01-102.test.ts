import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-102';

describe('OP01-102 Jack', () => {
  it('has an OnAttack manual discard effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnAttack');
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
