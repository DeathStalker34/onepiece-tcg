import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-096';

describe('OP01-096 King', () => {
  it('has an OnPlay sequence KO effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'sequence' });
  });
});
