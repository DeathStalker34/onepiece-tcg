import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-106';

describe('OP01-106 Basil Hawkins', () => {
  it('has an OnPlay manual DON!! add effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
