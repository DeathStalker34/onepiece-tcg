import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-016';

describe('OP01-016 Nami', () => {
  it('has an OnPlay search from deck', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'search', from: 'deck' });
  });
});
