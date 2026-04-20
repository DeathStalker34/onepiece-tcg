import { describe, expect, it } from 'vitest';
import { parseFilters, PAGE_SIZE } from './card-filters';

describe('parseFilters', () => {
  it('returns defaults for empty params', () => {
    const f = parseFilters({});
    expect(f.where).toEqual({});
    expect(f.page).toBe(1);
    expect(f.skip).toBe(0);
  });

  it('parses q into a case-insensitive contains on name', () => {
    const f = parseFilters({ q: 'luffy' });
    expect(f.where).toEqual({ name: { contains: 'luffy' } });
  });

  it('parses a single color', () => {
    const f = parseFilters({ color: 'Red' });
    expect(f.where).toEqual({ colors: { contains: 'Red' } });
  });

  it('parses multiple colors as AND of contains', () => {
    const f = parseFilters({ color: 'Red,Green' });
    expect(f.where).toEqual({
      AND: [{ colors: { contains: 'Red' } }, { colors: { contains: 'Green' } }],
    });
  });

  it('parses a single type', () => {
    const f = parseFilters({ type: 'CHARACTER' });
    expect(f.where).toEqual({ type: 'CHARACTER' });
  });

  it('parses a single cost as exact match', () => {
    const f = parseFilters({ cost: '3' });
    expect(f.where).toEqual({ cost: 3 });
  });

  it('parses multiple costs as IN', () => {
    const f = parseFilters({ cost: '3,4' });
    expect(f.where).toEqual({ cost: { in: [3, 4] } });
  });

  it('combines filters with AND at the top level', () => {
    const f = parseFilters({ q: 'luffy', type: 'LEADER', color: 'Red' });
    expect(f.where).toEqual({
      name: { contains: 'luffy' },
      type: 'LEADER',
      colors: { contains: 'Red' },
    });
  });

  it('computes skip from page', () => {
    const f = parseFilters({ page: '3' });
    expect(f.page).toBe(3);
    expect(f.skip).toBe(2 * PAGE_SIZE);
  });

  it('clamps page to >=1', () => {
    expect(parseFilters({ page: '0' }).page).toBe(1);
    expect(parseFilters({ page: '-5' }).page).toBe(1);
    expect(parseFilters({ page: 'abc' }).page).toBe(1);
  });
});
