export interface ParsedDeck {
  cards: Array<{ cardId: string; quantity: number }>;
}

// Normalized regex — parens/x already stripped by preprocessing, only space remains as separator.
// Card ID format: 1-3 uppercase letters + 0-2 digits + dash + digits, plus optional _pN variant suffix.
// Covers OP01-001, ST01-012, P-023 (promo), EB01-001 (future), OP01-001_p1 (variant).
const LINE_RE = /^(?:(\d+)\s+)?([A-Z]{1,3}\d{0,2}-\d+(?:_p\d+)?)(?:\s+(\d+))?$/;

function normalizeLine(raw: string): string {
  return raw.replace(/[()]/g, ' ').replace(/[xX]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parseDeckText(input: string): ParsedDeck {
  const bucket = new Map<string, number>();

  for (const rawLine of input.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const line = normalizeLine(trimmed);

    const m = LINE_RE.exec(line);
    if (!m) {
      throw new Error(`parseDeckText: cannot parse line: "${rawLine.trim()}"`);
    }

    const [, leadingQ, rawCardId, trailingQ] = m;
    const cardId = rawCardId.replace(/_p\d+$/, '');
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
