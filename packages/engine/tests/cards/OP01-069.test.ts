import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-069';

describe('OP01-069 Caesar Clown', () => {
  it('has an OnKO manual play effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnKO');
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
