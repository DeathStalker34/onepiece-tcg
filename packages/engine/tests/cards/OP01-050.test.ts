import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-050';

describe('OP01-050 Penguin', () => {
  it('has an OnPlay manual effect to play Shachi', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
