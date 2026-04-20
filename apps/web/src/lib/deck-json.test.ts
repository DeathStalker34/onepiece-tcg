import { describe, expect, it } from 'vitest';
import { serializeDeckJson, type DeckForExport } from './deck-json';

describe('serializeDeckJson', () => {
  it('produces version 1 envelope with leader and sorted cards', () => {
    const deck: DeckForExport = {
      name: 'My Deck',
      leaderCardId: 'OP01-001',
      cards: [
        { cardId: 'OP01-013', quantity: 4 },
        { cardId: 'OP01-001', quantity: 1 },
      ],
    };
    const obj = JSON.parse(serializeDeckJson(deck));
    expect(obj).toEqual({
      version: 1,
      name: 'My Deck',
      leader: 'OP01-001',
      cards: [
        { id: 'OP01-001', quantity: 1 },
        { id: 'OP01-013', quantity: 4 },
      ],
    });
  });

  it('handles null leader', () => {
    const deck: DeckForExport = {
      name: 'Empty',
      leaderCardId: null,
      cards: [],
    };
    const obj = JSON.parse(serializeDeckJson(deck));
    expect(obj.leader).toBeNull();
    expect(obj.cards).toEqual([]);
  });
});
