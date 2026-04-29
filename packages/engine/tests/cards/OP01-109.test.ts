import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-109';

describe("OP01-109 Who's.Who", () => {
  it('has a StaticAura on your turn with DON!! x1 conditional power', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('StaticAura');
    expect(effects[0].condition).toMatchObject({ onTurn: 'yours', attachedDonAtLeast: 1 });
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
