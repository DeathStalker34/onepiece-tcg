import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-041';

describe('OP01-041 Kouzuki Momonosuke', () => {
  it('has an Activate:Main search effect with DON cost 1', () => {
    expect(effects).toHaveLength(1);
    expect(effects[0].trigger).toBe('Activate:Main');
    expect(effects[0].cost).toMatchObject({ donX: 1 });
    expect(effects[0].effect).toMatchObject({ kind: 'search', from: 'deck' });
  });
});
