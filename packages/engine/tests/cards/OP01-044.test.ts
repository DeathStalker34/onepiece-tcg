import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-044';

describe('OP01-044 Shachi', () => {
  it('has an OnPlay manual effect to play Penguin', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
