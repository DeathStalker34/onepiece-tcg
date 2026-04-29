import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-020';

describe('OP01-020 Hyogoro', () => {
  it('has an Activate:Main power buff with no DON cost', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('Activate:Main');
    expect(effects[0].effect).toMatchObject({ kind: 'power', delta: 2000, optional: true });
  });
});
