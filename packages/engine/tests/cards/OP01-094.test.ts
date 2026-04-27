import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-094';

describe('OP01-094 Kaido', () => {
  it('has an OnPlay manual board wipe effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
