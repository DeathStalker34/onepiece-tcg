import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-079';

describe('OP01-079 Ms. All Sunday', () => {
  it('has an OnKO manual event recovery effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnKO');
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
