import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-028';

describe('OP01-028 Green Star Rafflesia', () => {
  it('has an OnPlay power debuff -2000 to opponent character', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'power', delta: -2000, optional: true });
  });
});
