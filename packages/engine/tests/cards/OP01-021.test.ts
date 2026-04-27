import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-021';

describe('OP01-021 Franky', () => {
  it('has a StaticAura with DON!! x1 manual effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('StaticAura');
    expect(effects[0].condition).toMatchObject({ attachedDonAtLeast: 1 });
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
