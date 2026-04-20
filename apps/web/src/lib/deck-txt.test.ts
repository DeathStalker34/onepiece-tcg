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

  it('parses compact "NxID" without space', () => {
    const r = parseDeckText('4xOP01-013\n2xOP01-014');
    expect(r.cards).toEqual([
      { cardId: 'OP01-013', quantity: 4 },
      { cardId: 'OP01-014', quantity: 2 },
    ]);
  });

  it('strips alt-art variant suffix _pN to the base card ID', () => {
    const r = parseDeckText('4xOP01-013_p1\n1xOP01-013_p4');
    expect(r.cards).toEqual([{ cardId: 'OP01-013', quantity: 5 }]);
  });

  it('accepts a mixed compact + variant decklist', () => {
    const input = [
      '1xOP01-001_p1',
      '4xOP01-013_p1',
      '4xOP01-016_p8',
      '4xOP01-021_p3',
      '4xOP01-022_p1',
      '4xOP01-024_p1',
      '4xOP01-025_p4',
      '3xOP01-027',
      '3xOP04-016',
      '3xOP06-018',
      '1xOP09-004_p6',
      '4xOP09-005_p1',
      '4xOP12-008_p1',
      '4xST01-006_p4',
      '4xST21-014_p1',
    ].join('\n');
    const r = parseDeckText(input);
    const total = r.cards.reduce((s, c) => s + c.quantity, 0);
    expect(total).toBe(51); // sum of quantities from the input
    // no _p suffix survives
    for (const c of r.cards) {
      expect(c.cardId).not.toMatch(/_p/);
    }
    // all cardIds are of the base shape (no _pN)
    for (const c of r.cards) {
      expect(c.cardId).toMatch(/^[A-Z]{2,3}\d{2}-\d+$/);
    }
    // contains an expected base ID
    expect(r.cards.map((c) => c.cardId)).toContain('OP01-001');
    expect(r.cards.map((c) => c.cardId)).toContain('ST21-014');
  });

  it('parses "N (ID)" parenthesized format', () => {
    const r = parseDeckText('4 (OP01-013)\n2 (OP01-014)');
    expect(r.cards).toEqual([
      { cardId: 'OP01-013', quantity: 4 },
      { cardId: 'OP01-014', quantity: 2 },
    ]);
  });

  it('parses promo card IDs like P-023', () => {
    const r = parseDeckText('2 (P-023)\n2xP-017');
    expect(r.cards).toEqual([
      { cardId: 'P-017', quantity: 2 },
      { cardId: 'P-023', quantity: 2 },
    ]);
  });

  it('parses the mixed paren-and-promo decklist from the user', () => {
    const input = [
      '1 (OP01-001)',
      '4 (OP01-006)',
      '4 (OP01-016)',
      '4 (ST01-006)',
      '4 (OP01-025)',
      '4 (OP01-017)',
      '4 (ST01-012)',
      '2 (ST01-004)',
      '4 (ST01-011)',
      '2 (OP01-022)',
      '2 (OP01-005)',
      '2 (P-023)',
      '2 (ST01-009)',
      '2 (P-017)',
      '2 (OP01-012)',
      '4 (ST01-015)',
      '2 (OP01-029)',
      '2 (ST01-016)',
    ].join('\n');
    const r = parseDeckText(input);
    const total = r.cards.reduce((s, c) => s + c.quantity, 0);
    expect(total).toBe(51);
    expect(r.cards.map((c) => c.cardId)).toContain('OP01-001');
    expect(r.cards.map((c) => c.cardId)).toContain('P-023');
    expect(r.cards.map((c) => c.cardId)).toContain('P-017');
    expect(r.cards.map((c) => c.cardId)).toContain('ST01-016');
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
