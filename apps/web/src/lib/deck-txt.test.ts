import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDeckText, serializeDeckText, type ParsedDeck } from './deck-txt';

describe('parseDeckText', () => {
  it('parses "Nx ID" lines', () => {
    const r = parseDeckText('4x OP01-001\n4x OP01-013');
    expect(r.cards).toEqual([
      { cardId: 'OP01-001', quantity: 4 },
      { cardId: 'OP01-013', quantity: 4 },
    ]);
  });

  it('parses "ID xN" lines', () => {
    const r = parseDeckText('OP01-001 x 4\nOP01-013 x4');
    expect(r.cards).toEqual([
      { cardId: 'OP01-001', quantity: 4 },
      { cardId: 'OP01-013', quantity: 4 },
    ]);
  });

  it('defaults to quantity 1 when bare ID', () => {
    const r = parseDeckText('OP01-001');
    expect(r.cards).toEqual([{ cardId: 'OP01-001', quantity: 1 }]);
  });

  it('ignores empty lines and # comments', () => {
    const input = `# leader OP01-001
# this is a comment

4x OP01-013

    `;
    const r = parseDeckText(input);
    expect(r.cards).toEqual([{ cardId: 'OP01-013', quantity: 4 }]);
  });

  it('sums duplicates', () => {
    const r = parseDeckText('OP01-013\nOP01-013\n2x OP01-013');
    expect(r.cards).toEqual([{ cardId: 'OP01-013', quantity: 4 }]);
  });

  it('tolerates extra whitespace', () => {
    const r = parseDeckText('  4x OP01-013  ');
    expect(r.cards).toEqual([{ cardId: 'OP01-013', quantity: 4 }]);
  });

  it('throws on lines that match nothing recognisable', () => {
    expect(() => parseDeckText('some random text')).toThrow(/parse/i);
  });
});

describe('serializeDeckText', () => {
  it('produces "ID x N" lines sorted by id', () => {
    const deck: ParsedDeck = {
      cards: [
        { cardId: 'OP01-013', quantity: 4 },
        { cardId: 'OP01-001', quantity: 4 },
      ],
    };
    const out = serializeDeckText(deck);
    expect(out).toBe('OP01-001 x 4\nOP01-013 x 4');
  });

  it('round-trips parse(serialize(x))', () => {
    const original: ParsedDeck = {
      cards: [
        { cardId: 'OP01-001', quantity: 4 },
        { cardId: 'OP01-013', quantity: 2 },
        { cardId: 'OP02-001', quantity: 1 },
      ],
    };
    const text = serializeDeckText(original);
    const reparsed = parseDeckText(text);
    expect(reparsed.cards).toEqual(original.cards);
  });
});

describe('parseDeckText fixtures', () => {
  it('parses op01-zoro-red.txt into a non-empty deck', () => {
    const content = readFileSync(
      join(__dirname, '../../../../packages/card-data/fixtures/decks/op01-zoro-red.txt'),
      'utf8',
    );
    const r = parseDeckText(content);
    expect(r.cards.length).toBeGreaterThan(0);
    for (const c of r.cards) {
      expect(c.cardId).toMatch(/^OP\d{2}-\d+/);
    }
  });

  it('parses op02-blackbeard-black.txt into a non-empty deck', () => {
    const content = readFileSync(
      join(__dirname, '../../../../packages/card-data/fixtures/decks/op02-blackbeard-black.txt'),
      'utf8',
    );
    const r = parseDeckText(content);
    expect(r.cards.length).toBeGreaterThan(0);
  });
});
