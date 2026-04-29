import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-042';

describe('OP01-042 Komurasaki', () => {
  it('has an OnPlay manual effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
