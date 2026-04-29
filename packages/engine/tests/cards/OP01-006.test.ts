import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-006';

describe('OP01-006 Otama', () => {
  it('has an OnPlay power debuff to opponent character', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'power', delta: -2000, optional: true });
  });
});
