import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-117';

describe("OP01-117 Sheep's Horn", () => {
  it('has an OnPlay manual rest effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
