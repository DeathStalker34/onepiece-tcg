import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-113';

describe('OP01-113 Holedem', () => {
  it('has an OnKO manual DON!! add effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnKO');
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
