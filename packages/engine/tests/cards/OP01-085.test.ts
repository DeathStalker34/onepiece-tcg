import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-085';

describe('OP01-085 Mr.3(Galdino)', () => {
  it('has an OnPlay manual stun effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
