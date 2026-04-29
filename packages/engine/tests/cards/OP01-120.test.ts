import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-120';

describe('OP01-120 Shanks', () => {
  it('has an OnAttack no-blocker manual effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnAttack');
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
