import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-030';

describe('OP01-030 In Two Years!! At the Sabaody Archipelago!!', () => {
  it('has an OnPlay search from deck', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'search', from: 'deck' });
  });
});
