export interface DeckForExport {
  name: string;
  leaderCardId: string | null;
  cards: Array<{ cardId: string; quantity: number }>;
}

export function serializeDeckJson(deck: DeckForExport): string {
  const payload = {
    version: 1,
    name: deck.name,
    leader: deck.leaderCardId,
    cards: [...deck.cards]
      .sort((a, b) => a.cardId.localeCompare(b.cardId))
      .map((c) => ({ id: c.cardId, quantity: c.quantity })),
  };
  return JSON.stringify(payload, null, 2);
}
