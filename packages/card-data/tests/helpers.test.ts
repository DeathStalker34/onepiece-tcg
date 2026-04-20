import { describe, expect, it } from 'vitest';
import { splitMultiValue, rawToDomain, normalizeCounter } from '../src/helpers';
import type { RawCard } from '../src/types';

describe('splitMultiValue', () => {
  it('splits by "/"', () => {
    expect(splitMultiValue('Red/Green')).toEqual(['Red', 'Green']);
  });

  it('splits by ","', () => {
    expect(splitMultiValue('Straw Hat Crew,Supernovas')).toEqual(['Straw Hat Crew', 'Supernovas']);
  });

  it('trims whitespace', () => {
    expect(splitMultiValue('Red / Green')).toEqual(['Red', 'Green']);
  });

  it('returns empty array for empty string', () => {
    expect(splitMultiValue('')).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(splitMultiValue(undefined)).toEqual([]);
  });

  it('returns single element for single value', () => {
    expect(splitMultiValue('Red')).toEqual(['Red']);
  });
});

describe('normalizeCounter', () => {
  it('returns null for sentinel "-"', () => {
    expect(normalizeCounter('-')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normalizeCounter('')).toBeNull();
  });

  it('parses digit strings like "1000"', () => {
    expect(normalizeCounter('1000')).toBe(1000);
  });

  it('returns numbers as-is', () => {
    expect(normalizeCounter(1000)).toBe(1000);
  });

  it('returns null for non-numeric strings', () => {
    expect(normalizeCounter('abc')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(normalizeCounter(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(normalizeCounter(undefined)).toBeNull();
  });
});

describe('rawToDomain', () => {
  const raw: RawCard = {
    id: 'OP01-001',
    code: 'OP01-001',
    name: 'Roronoa Zoro',
    rarity: 'L',
    type: 'LEADER',
    power: 5000,
    life: 4,
    color: 'Green',
    family: 'Straw Hat Crew',
    ability: '[Activate: Main] ...',
    set: { id: 'OP01', name: 'Romance Dawn' },
    images: { large: 'https://example.com/op01-001.webp' },
  };

  it('maps scalar fields 1:1', () => {
    const d = rawToDomain(raw);
    expect(d.id).toBe('OP01-001');
    expect(d.setId).toBe('OP01');
    expect(d.setName).toBe('Romance Dawn');
    expect(d.name).toBe('Roronoa Zoro');
    expect(d.rarity).toBe('L');
    expect(d.type).toBe('LEADER');
    expect(d.power).toBe(5000);
    expect(d.life).toBe(4);
  });

  it('converts optional undefined to null', () => {
    const d = rawToDomain(raw);
    expect(d.cost).toBeNull();
    expect(d.counter).toBeNull();
    expect(d.triggerText).toBeNull();
  });

  it('splits color into colors array', () => {
    expect(rawToDomain({ ...raw, color: 'Red/Green' }).colors).toEqual(['Red', 'Green']);
  });

  it('splits family into attributes array', () => {
    expect(rawToDomain({ ...raw, family: 'Straw Hat Crew,Supernovas' }).attributes).toEqual([
      'Straw Hat Crew',
      'Supernovas',
    ]);
  });

  it('handles missing family/ability/trigger', () => {
    const minimal: RawCard = {
      ...raw,
      family: undefined,
      ability: undefined,
      trigger: undefined,
    };
    const d = rawToDomain(minimal);
    expect(d.attributes).toEqual([]);
    expect(d.effectText).toBe('');
    expect(d.triggerText).toBeNull();
  });

  it('uses images.large as sourceImageUrl', () => {
    expect(rawToDomain(raw).sourceImageUrl).toBe('https://example.com/op01-001.webp');
  });

  it('derives setId from code prefix when set.id is missing', () => {
    const noSetId: RawCard = {
      ...raw,
      set: { name: '-ROMANCE DAWN- [OP01]' },
    };
    expect(rawToDomain(noSetId).setId).toBe('OP01');
  });

  it('derives setId from id prefix when both set.id and code are missing', () => {
    const onlyId: RawCard = {
      ...raw,
      code: undefined,
      set: { name: '-ROMANCE DAWN- [OP01]' },
    };
    expect(rawToDomain(onlyId).setId).toBe('OP01');
  });

  it('treats empty-string trigger as null', () => {
    const emptyTrigger: RawCard = { ...raw, trigger: '' };
    expect(rawToDomain(emptyTrigger).triggerText).toBeNull();
  });

  it('normalizes counter "-" to null', () => {
    const withDash: RawCard = { ...raw, counter: '-' };
    expect(rawToDomain(withDash).counter).toBeNull();
  });

  it('normalizes counter "1000" string to 1000', () => {
    const withStr: RawCard = { ...raw, counter: '1000' };
    expect(rawToDomain(withStr).counter).toBe(1000);
  });
});
