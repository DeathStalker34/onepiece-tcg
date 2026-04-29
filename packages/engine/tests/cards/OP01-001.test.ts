import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-001';

describe('OP01-001 Roronoa Zoro (Leader)', () => {
  it('exposes a single StaticAura granting +1000 to own characters on your turn with 1+ DON', () => {
    expect(effects).toHaveLength(1);
    const aura = effects[0];
    expect(aura.trigger).toBe('StaticAura');
    expect(aura.condition).toEqual({ onTurn: 'yours', attachedDonAtLeast: 1 });
    expect(aura.effect).toMatchObject({
      kind: 'power',
      target: { kind: 'ownCharacter' },
      delta: 1000,
      duration: 'permanent',
    });
  });
});
