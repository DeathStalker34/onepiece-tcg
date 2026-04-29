import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-056';

describe('OP01-056 Demon Face', () => {
  it('has an OnPlay KO opponent character with cost <= 5', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'ko', optional: true });
  });
});
