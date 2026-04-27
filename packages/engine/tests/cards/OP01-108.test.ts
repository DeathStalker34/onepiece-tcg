import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-108';

describe('OP01-108 Hitokiri Kamazo', () => {
  it('has an OnKO KO opponent character with cost <= 5', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnKO');
    expect(effects[0].effect).toMatchObject({ kind: 'ko', optional: true });
  });
});
