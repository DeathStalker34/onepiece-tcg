export interface ParsedDeck {
  cards: Array<{ cardId: string; quantity: number }>;
}

const LINE_RE = /^\s*(?:(\d+)\s*[xX]\s+)?([A-Z]{2,3}\d{2}-\d+(?:_p\d+)?)(?:\s*[xX]\s*(\d+))?\s*$/;

export function parseDeckText(input: string): ParsedDeck {
  const bucket = new Map<string, number>();

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const m = LINE_RE.exec(line);
    if (!m) {
      throw new Error(`parseDeckText: cannot parse line: "${line}"`);
    }

    const [, leadingQ, cardId, trailingQ] = m;
    const qty = Number(leadingQ ?? trailingQ ?? 1);
    bucket.set(cardId, (bucket.get(cardId) ?? 0) + qty);
  }

  const cards = [...bucket.entries()]
    .map(([cardId, quantity]) => ({ cardId, quantity }))
    .sort((a, b) => a.cardId.localeCompare(b.cardId));

  return { cards };
}

export function serializeDeckText(deck: ParsedDeck): string {
  return [...deck.cards]
    .sort((a, b) => a.cardId.localeCompare(b.cardId))
    .map((c) => `${c.cardId} x ${c.quantity}`)
    .join('\n');
}
