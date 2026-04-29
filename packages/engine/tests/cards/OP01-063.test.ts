import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-063';

describe('OP01-063 Arlong', () => {
  it('has an Activate:Main reveal opponent hand effect', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('Activate:Main');
    expect(effects[0].condition).toMatchObject({ attachedDonAtLeast: 1 });
    expect(effects[0].effect).toMatchObject({ kind: 'manual' });
  });
});
