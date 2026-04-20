import { describe, expect, it } from 'vitest';
import { CARD_TYPES, RawCardSchema } from '../src/types';

const validRaw = {
  id: 'OP01-001',
  name: 'Roronoa Zoro',
  rarity: 'L',
  type: 'LEADER',
  cost: undefined,
  power: 5000,
  counter: undefined,
  life: 4,
  color: 'Green',
  family: 'Straw Hat Crew',
  ability: '[Activate: Main] You may rest this Leader: ...',
  trigger: undefined,
  set: { id: 'OP01', name: 'Romance Dawn' },
  images: { large: 'https://example.com/op01-001.webp' },
};

describe('RawCardSchema', () => {
  it('accepts a valid leader payload', () => {
    expect(() => RawCardSchema.parse(validRaw)).not.toThrow();
  });

  it('rejects when set.id is missing', () => {
    const bad = { ...validRaw, set: { name: 'Romance Dawn' } as { id?: string; name: string } };
    expect(() => RawCardSchema.parse(bad)).toThrow();
  });

  it('rejects when type is an unexpected string', () => {
    const bad = { ...validRaw, type: 'NOT_A_TYPE' };
    expect(() => RawCardSchema.parse(bad)).toThrow();
  });

  it('rejects when cost is a string instead of number', () => {
    const bad = { ...validRaw, cost: '3' as unknown as number };
    expect(() => RawCardSchema.parse(bad)).toThrow();
  });
});

describe('CARD_TYPES', () => {
  it('lists all 5 card types', () => {
    expect(CARD_TYPES).toEqual(['LEADER', 'CHARACTER', 'EVENT', 'STAGE', 'DON']);
  });
});
