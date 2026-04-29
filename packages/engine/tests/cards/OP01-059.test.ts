import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-059';

describe('OP01-059 BE-BENG!!', () => {
  it('has an OnPlay manual activation effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
