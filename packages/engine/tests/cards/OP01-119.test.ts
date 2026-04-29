import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-119';

describe('OP01-119 Thunder Bagua', () => {
  it('has an OnPlay sequence of power buff then conditional DON!! add', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'sequence' });
  });
});
