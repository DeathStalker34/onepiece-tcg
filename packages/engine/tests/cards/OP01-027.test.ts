import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-027';

describe('OP01-027 Round Table', () => {
  it('has an OnPlay power debuff -10000 to opponent character', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'power', delta: -10000, optional: true });
  });
});
