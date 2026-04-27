import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-088';

describe('OP01-088 Desert Spada', () => {
  it('has an OnPlay sequence of power buff then deck manipulation', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'sequence' });
  });
});
