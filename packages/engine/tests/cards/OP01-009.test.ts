import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-009';

describe('OP01-009 Carrot', () => {
  it('has a Trigger effect to play this card', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('Trigger');
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
