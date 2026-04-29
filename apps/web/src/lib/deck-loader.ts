import { apiUrl } from './api';

export interface DeckCardInput {
  cardId: string;
  quantity: number;
}

export interface LoadedDeck {
  deck: string[];
  leaderCardId: string;
  deckName: string;
}

export function expandDeckCards(cards: DeckCardInput[]): string[] {
  const out: string[] = [];
  for (const c of cards) {
    for (let i = 0; i < c.quantity; i += 1) {
      out.push(c.cardId);
    }
  }
  return out;
}

export async function loadGameDeckById(deckId: string, userId: string): Promise<LoadedDeck> {
  const res = await fetch(apiUrl(`/api/decks/${deckId}`), { headers: { 'x-user-id': userId } });
  if (!res.ok) {
    throw new Error(`Failed to load deck ${deckId}: HTTP ${res.status}`);
  }
  const body = (await res.json()) as {
    id: string;
    name: string;
    leaderCardId: string | null;
    cards: Array<{ cardId: string; quantity: number }>;
  };
  if (!body.leaderCardId) {
    throw new Error(`Deck "${body.name}" has no leader set`);
  }
  const deck = expandDeckCards(body.cards);
  if (deck.length !== 50) {
    throw new Error(`Deck "${body.name}" has ${deck.length} cards, expected 50`);
  }
  return { deck, leaderCardId: body.leaderCardId, deckName: body.name };
}
