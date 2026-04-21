import { describe, expect, it } from 'vitest';
import { validateDeck, type DeckDraft, type CardRow } from '../src/deck';

function card(overrides: Partial<CardRow> & Pick<CardRow, 'id' | 'colors'>): CardRow {
  return {
    id: overrides.id,
    colors: overrides.colors,
    type: overrides.type ?? 'CHARACTER',
  };
}

const cards = new Map<string, CardRow>([
  ['OP01-001', card({ id: 'OP01-001', colors: ['Red'], type: 'LEADER' })],
  ['OP01-002', card({ id: 'OP01-002', colors: ['Red', 'Green'], type: 'LEADER' })],
  ['OP01-013', card({ id: 'OP01-013', colors: ['Red'] })],
  ['OP01-014', card({ id: 'OP01-014', colors: ['Green'] })],
  ['OP01-015', card({ id: 'OP01-015', colors: ['Blue'] })],
]);

describe('validateDeck', () => {
  it('flags missingLeader when leader is null', () => {
    const draft: DeckDraft = { leaderCardId: null, cards: [] };
    const r = validateDeck(draft, cards);
    expect(r.issues).toContainEqual({ kind: 'missingLeader' });
    expect(r.isLegal).toBe(false);
  });

  it('flags wrongCount when not exactly 50', () => {
    const draft: DeckDraft = {
      leaderCardId: 'OP01-001',
      cards: [{ cardId: 'OP01-013', quantity: 4 }],
    };
    const r = validateDeck(draft, cards);
    expect(r.issues).toContainEqual({ kind: 'wrongCount', expected: 50, actual: 4 });
    expect(r.totalCards).toBe(4);
  });

  it('flags overLimit when quantity > 4', () => {
    const draft: DeckDraft = {
      leaderCardId: 'OP01-001',
      cards: [{ cardId: 'OP01-013', quantity: 5 }],
    };
    const r = validateDeck(draft, cards);
    expect(r.issues).toContainEqual({
      kind: 'overLimit',
      cardId: 'OP01-013',
      quantity: 5,
    });
  });

  it('flags colorMismatch when card shares no color with leader', () => {
    const draft: DeckDraft = {
      leaderCardId: 'OP01-001',
      cards: [{ cardId: 'OP01-015', quantity: 4 }],
    };
    const r = validateDeck(draft, cards);
    expect(r.issues).toContainEqual({
      kind: 'colorMismatch',
      cardId: 'OP01-015',
      leaderColors: ['Red'],
      cardColors: ['Blue'],
    });
  });

  it('accepts a card that shares one of multiple leader colors', () => {
    const draft: DeckDraft = {
      leaderCardId: 'OP01-002',
      cards: [
        { cardId: 'OP01-013', quantity: 4 },
        { cardId: 'OP01-014', quantity: 4 },
      ],
    };
    const r = validateDeck(draft, cards);
    expect(r.issues.some((i) => i.kind === 'colorMismatch')).toBe(false);
  });

  it('considers a deck legal with leader + 50 exact + 4-max + matching colors', () => {
    const list: { cardId: string; quantity: number }[] = [];
    const bigCatalog = new Map(cards);
    for (let i = 100; i < 113; i += 1) {
      const id = `OP01-${i.toString().padStart(3, '0')}`;
      bigCatalog.set(id, card({ id, colors: ['Red'] }));
      list.push({ cardId: id, quantity: 4 });
    }
    list[list.length - 1].quantity = 2;
    const draft: DeckDraft = { leaderCardId: 'OP01-001', cards: list };
    const r = validateDeck(draft, bigCatalog);
    expect(r.totalCards).toBe(50);
    expect(r.isLegal).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it('sums multiple issues when deck is broken in many ways', () => {
    const draft: DeckDraft = {
      leaderCardId: null,
      cards: [{ cardId: 'OP01-015', quantity: 5 }],
    };
    const r = validateDeck(draft, cards);
    expect(r.issues.some((i) => i.kind === 'missingLeader')).toBe(true);
    expect(r.issues.some((i) => i.kind === 'overLimit')).toBe(true);
    expect(r.issues.some((i) => i.kind === 'wrongCount')).toBe(true);
  });
});
