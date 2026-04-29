import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-040';

describe("OP01-040 Kin'emon", () => {
  it('has an OnPlay manual play effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
