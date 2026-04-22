import { describe, expect, it } from 'vitest';
import type { Card } from '@optcg/card-data';
import { buildCatalog, cardToStatic, parseKeywords } from './catalog-builder';

function mkCard(
  overrides: Partial<Card> &
    Pick<
      Card,
      | 'id'
      | 'type'
      | 'name'
      | 'colors'
      | 'rarity'
      | 'setId'
      | 'setName'
      | 'imagePath'
      | 'sourceUrl'
      | 'effectText'
    >,
): Card {
  return {
    id: overrides.id,
    setId: overrides.setId,
    setName: overrides.setName,
    name: overrides.name,
    rarity: overrides.rarity,
    type: overrides.type,
    cost: overrides.cost ?? null,
    power: overrides.power ?? null,
    counter: overrides.counter ?? null,
    life: overrides.life ?? null,
    colors: overrides.colors,
    attributes: overrides.attributes ?? '',
    effectText: overrides.effectText ?? '',
    triggerText: overrides.triggerText ?? null,
    imagePath: overrides.imagePath,
    sourceUrl: overrides.sourceUrl,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Card;
}

describe('cardToStatic', () => {
  it('maps LEADER cost to life and nulls cost', () => {
    const c = mkCard({
      id: 'OP01-001',
      type: 'LEADER',
      name: 'Zoro',
      rarity: 'L',
      setId: 'OP01',
      setName: 'RD',
      colors: 'Red',
      cost: 4,
      power: 5000,
      imagePath: '/cards/OP01/OP01-001.webp',
      sourceUrl: '',
      effectText: '',
    });
    const s = cardToStatic(c);
    expect(s.type).toBe('LEADER');
    expect(s.life).toBe(4);
    expect(s.cost).toBeNull();
    expect(s.power).toBe(5000);
  });

  it('preserves CHARACTER cost/power/counter', () => {
    const c = mkCard({
      id: 'OP01-013',
      type: 'CHARACTER',
      name: 'Sanji',
      rarity: 'C',
      setId: 'OP01',
      setName: 'RD',
      colors: 'Red',
      cost: 3,
      power: 4000,
      counter: 1000,
      imagePath: '',
      sourceUrl: '',
      effectText: '',
    });
    const s = cardToStatic(c);
    expect(s.type).toBe('CHARACTER');
    expect(s.cost).toBe(3);
    expect(s.power).toBe(4000);
    expect(s.counter).toBe(1000);
    expect(s.life).toBeNull();
  });

  it('EVENT null power', () => {
    const c = mkCard({
      id: 'OP01-024',
      type: 'EVENT',
      name: 'Guard Point',
      rarity: 'C',
      setId: 'OP01',
      setName: 'RD',
      colors: 'Green',
      cost: 1,
      power: null,
      imagePath: '',
      sourceUrl: '',
      effectText: '',
    });
    const s = cardToStatic(c);
    expect(s.power).toBeNull();
    expect(s.cost).toBe(1);
  });

  it('splits multi-color', () => {
    const c = mkCard({
      id: 'OP01-002',
      type: 'LEADER',
      name: 'Law',
      rarity: 'L',
      setId: 'OP01',
      setName: 'RD',
      colors: 'Red,Green',
      cost: 4,
      power: 5000,
      imagePath: '',
      sourceUrl: '',
      effectText: '',
    });
    expect(cardToStatic(c).colors).toEqual(['Red', 'Green']);
  });

  it('unknown type defaults to CHARACTER', () => {
    const c = mkCard({
      id: 'X',
      type: 'DON',
      name: 'don',
      rarity: 'C',
      setId: 'OP01',
      setName: 'RD',
      colors: 'Red',
      cost: 0,
      power: null,
      imagePath: '',
      sourceUrl: '',
      effectText: '',
    });
    expect(cardToStatic(c).type).toBe('CHARACTER');
  });
});

describe('parseKeywords', () => {
  it('detects Rush from [Rush]', () => {
    expect(parseKeywords('[Rush] enters active')).toContain('Rush');
  });

  it('detects Blocker', () => {
    expect(parseKeywords('[Blocker] at any time')).toContain('Blocker');
  });

  it('detects Double Attack with space', () => {
    expect(parseKeywords('[Double Attack] deal 2 damage')).toContain('DoubleAttack');
  });

  it('detects Banish', () => {
    expect(parseKeywords('[Banish] on KO')).toContain('Banish');
  });

  it('handles null/empty', () => {
    expect(parseKeywords(null)).toEqual([]);
    expect(parseKeywords('')).toEqual([]);
  });

  it('does not falsely match', () => {
    expect(parseKeywords('A character attacks')).toEqual([]);
  });
});

describe('buildCatalog', () => {
  it('produces a map keyed by id', () => {
    const cards = [
      mkCard({
        id: 'A',
        type: 'CHARACTER',
        name: 'A',
        rarity: 'C',
        setId: 'X',
        setName: 'X',
        colors: 'Red',
        imagePath: '',
        sourceUrl: '',
        effectText: '',
      }),
      mkCard({
        id: 'B',
        type: 'CHARACTER',
        name: 'B',
        rarity: 'C',
        setId: 'X',
        setName: 'X',
        colors: 'Red',
        imagePath: '',
        sourceUrl: '',
        effectText: '',
      }),
    ];
    const map = buildCatalog(cards);
    expect(Object.keys(map)).toEqual(['A', 'B']);
    expect(map.A.id).toBe('A');
  });
});
