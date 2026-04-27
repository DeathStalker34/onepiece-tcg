import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-015';

describe('OP01-015 Tony Tony.Chopper', () => {
  it('has an OnAttack search from trash with DON!! condition', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnAttack');
    expect(effects[0].effect).toMatchObject({ kind: 'search', from: 'trash' });
  });
});
