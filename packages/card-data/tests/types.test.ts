import { describe, expect, it } from 'vitest';
import { CARD_TYPES, RawCardSchema } from '../src/types';

const validRaw = {
  id: 'OP01-001',
  code: 'OP01-001',
  name: 'Roronoa Zoro',
  rarity: 'L',
  type: 'LEADER',
  cost: 5,
  power: 5000,
  counter: '-',
  color: 'Red',
  family: 'Supernovas/Straw Hat Crew',
  ability: '[DON!! x1] [Your Turn] All of your Characters gain +1000 power.',
  trigger: '',
  attribute: { name: 'Slash', image: 'https://example.com/ico.png' },
  set: { name: '-ROMANCE DAWN- [OP01]' },
  images: { large: 'https://example.com/op01-001.webp' },
};

describe('RawCardSchema', () => {
  it('accepts a valid leader payload (real wire shape)', () => {
    expect(() => RawCardSchema.parse(validRaw)).not.toThrow();
  });

  it('accepts set without id (real feed omits it)', () => {
    const noSetId = { ...validRaw, set: { name: 'Romance Dawn' } };
    expect(() => RawCardSchema.parse(noSetId)).not.toThrow();
  });

  it('rejects when set.name is missing', () => {
    const bad = { ...validRaw, set: {} as { id?: string; name?: string } };
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

  it('accepts counter as string (e.g. "1000")', () => {
    const s = { ...validRaw, counter: '1000' };
    expect(() => RawCardSchema.parse(s)).not.toThrow();
  });

  it('accepts counter as "-" sentinel', () => {
    const s = { ...validRaw, counter: '-' };
    expect(() => RawCardSchema.parse(s)).not.toThrow();
  });

  it('accepts null power (EVENT cards)', () => {
    const s = { ...validRaw, type: 'EVENT' as const, power: null };
    expect(() => RawCardSchema.parse(s)).not.toThrow();
  });
});

describe('CARD_TYPES', () => {
  it('lists all 5 card types', () => {
    expect(CARD_TYPES).toEqual(['LEADER', 'CHARACTER', 'EVENT', 'STAGE', 'DON']);
  });
});
