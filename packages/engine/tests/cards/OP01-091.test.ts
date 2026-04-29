import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-091';

describe('OP01-091 King (Leader)', () => {
  it('has a StaticAura on your turn power debuff to opponent characters', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('StaticAura');
    expect(effects[0].condition).toMatchObject({ onTurn: 'yours' });
    expect(effects[0].effect).toMatchObject({ kind: 'power', delta: -1000 });
  });
});
