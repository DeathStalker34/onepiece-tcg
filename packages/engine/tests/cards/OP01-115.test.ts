import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-115';

describe("OP01-115 Elephant's Marchoo", () => {
  it('has an OnPlay sequence of KO then DON!! add', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'sequence' });
  });
});
