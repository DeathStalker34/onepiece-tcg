import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-038';

describe('OP01-038 Kanjuro', () => {
  it('has OnAttack and OnKO effects', () => {
    expect(effects).toHaveLength(2);
    expect(effects[0].trigger).toBe('OnAttack');
    expect(effects[1].trigger).toBe('OnKO');
  });
});
