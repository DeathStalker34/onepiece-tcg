import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-017';

describe('OP01-017 Nico Robin', () => {
  it('has an OnAttack KO with DON!! x1 condition', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnAttack');
    expect(effects[0].condition).toMatchObject({ attachedDonAtLeast: 1 });
    expect(effects[0].effect).toMatchObject({ kind: 'ko', optional: true });
  });
});
