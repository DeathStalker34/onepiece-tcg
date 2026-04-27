import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-026';

describe('OP01-026 Gum-Gum Fire-Fist Pistol Red Hawk', () => {
  it('has an OnPlay sequence of power buff then KO', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('OnPlay');
    expect(effects[0].effect).toMatchObject({ kind: 'sequence' });
  });
});
