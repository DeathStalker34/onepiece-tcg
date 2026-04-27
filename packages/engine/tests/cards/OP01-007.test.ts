import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-007';

describe('OP01-007 Caribou', () => {
  it('has an OnKO that KOs opponent character with power <= 4000', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnKO');
    expect(effects[0].effect).toMatchObject({ kind: 'ko', optional: true });
  });
});
