import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-005';

describe('OP01-005 Uta', () => {
  it('has an OnPlay search effect from trash', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'search', from: 'trash' });
  });
});
