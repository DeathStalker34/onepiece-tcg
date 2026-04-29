import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-070';

describe('OP01-070 Dracule Mihawk', () => {
  it('has an OnPlay manual bottom deck effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
