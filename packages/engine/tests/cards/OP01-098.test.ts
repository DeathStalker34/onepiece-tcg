import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-098';

describe('OP01-098 Kurozumi Orochi', () => {
  it('has an OnPlay search from deck for event', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'search', from: 'deck' });
  });
});
