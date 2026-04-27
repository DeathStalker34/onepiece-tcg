import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-029';

describe('OP01-029 Radical Beam!!', () => {
  it('has an OnPlay power buff +2000 to self', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'power', delta: 2000, optional: true });
  });
});
