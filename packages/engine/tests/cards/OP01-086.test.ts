import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-086';

describe('OP01-086 Overheat', () => {
  it('has an OnPlay sequence of power buff then return to hand', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'sequence' });
  });
});
