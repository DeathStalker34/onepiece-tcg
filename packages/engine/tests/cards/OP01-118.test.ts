import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-118';

describe('OP01-118 Ulti-Mortar', () => {
  it('has an OnPlay sequence of power buff then draw', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'sequence' });
  });
});
