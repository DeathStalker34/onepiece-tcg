import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-019';

describe('OP01-019 Bartolomeo', () => {
  it('has a StaticAura power buff on opponents turn with DON!! x2', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('StaticAura');
    expect(effects[0].condition).toMatchObject({ onTurn: 'opponents', attachedDonAtLeast: 2 });
    expect(effects[0].effect).toMatchObject({ kind: 'power', delta: 3000 });
  });
});
