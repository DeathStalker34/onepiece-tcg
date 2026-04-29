import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-071';

describe('OP01-071 Jinbe', () => {
  it('has an OnPlay manual bottom deck effect for cost <= 3', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
