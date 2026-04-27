import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-105';

describe('OP01-105 Bao Huang', () => {
  it('has an OnPlay manual hand reveal effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
