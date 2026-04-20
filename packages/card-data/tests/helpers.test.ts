import { describe, expect, it } from 'vitest';
import { splitMultiValue, rawToDomain } from '../src/helpers';
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

describe('rawToDomain', () => {
  const raw: RawCard = {
    id: 'OP01-001',
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
});
