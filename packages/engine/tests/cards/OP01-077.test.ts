import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-077';

describe('OP01-077 Perona', () => {
  it('has an OnPlay manual deck manipulation effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
