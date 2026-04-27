import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-099';

describe('OP01-099 Kurozumi Semimaru', () => {
  it('has a StaticAura protection effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('StaticAura');
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
