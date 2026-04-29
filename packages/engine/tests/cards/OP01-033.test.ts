import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-033';

describe('OP01-033 Izo', () => {
  it('has an OnPlay rest effect (manual)', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
