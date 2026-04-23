import { describe, it, expect } from 'vitest';
import { buildCatalogFromRows } from '../scripts/export-catalog';

describe('buildCatalogFromRows', () => {
  it('produces CardStatic entries keyed by id', () => {
    const rows = [
      {
        id: 'OP01-001',
        type: 'LEADER',
        colors: 'Red',
        cost: 5,
        power: 5000,
        counter: null,
        effectText: 'Your turn, your characters get +1000.',
      },
    ];
    const catalog = buildCatalogFromRows(rows);
    expect(catalog['OP01-001']).toBeDefined();
    expect(catalog['OP01-001'].type).toBe('LEADER');
    expect(catalog['OP01-001'].life).toBe(5);
    expect(catalog['OP01-001'].cost).toBeNull();
  });

  it('skips DON and unknown types by coercing to CHARACTER', () => {
    const rows = [
      {
        id: 'X-001',
        type: 'UNKNOWN',
        colors: 'Green',
        cost: 2,
        power: 3000,
        counter: null,
        effectText: null,
      },
    ];
    const catalog = buildCatalogFromRows(rows);
    expect(catalog['X-001'].type).toBe('CHARACTER');
  });
});
