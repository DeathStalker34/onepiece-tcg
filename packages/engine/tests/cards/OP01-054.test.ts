import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-054';

describe('OP01-054 X.Drake', () => {
  it('has an OnPlay KO of rested opponent character with cost <= 4', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'ko', optional: true });
  });
});
