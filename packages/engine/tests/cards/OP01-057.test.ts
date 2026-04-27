import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-057';

describe('OP01-057 Paradise Waterfall', () => {
  it('has an OnPlay sequence with power buff and manual', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'sequence' });
  });
});
