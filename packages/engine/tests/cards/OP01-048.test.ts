import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-048';

describe('OP01-048 Nekomamushi', () => {
  it('has an OnPlay manual rest effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
