import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-068';

describe('OP01-068 Gecko Moria', () => {
  it('has a StaticAura on your turn with double attack effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('StaticAura');
    expect(effects[0].condition).toMatchObject({ onTurn: 'yours' });
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
