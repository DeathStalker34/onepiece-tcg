import { describe, expect, it, vi, afterEach } from 'vitest';
import { expandDeckCards, loadGameDeckById } from './deck-loader';

describe('expandDeckCards', () => {
  it('repeats each cardId by its quantity', () => {
    expect(
      expandDeckCards([
        { cardId: 'A', quantity: 3 },
        { cardId: 'B', quantity: 2 },
      ]),
    ).toEqual(['A', 'A', 'A', 'B', 'B']);
  });

  it('empty input → empty output', () => {
    expect(expandDeckCards([])).toEqual([]);
  });

  it('preserves order of cardIds', () => {
    expect(
      expandDeckCards([
        { cardId: 'B', quantity: 1 },
        { cardId: 'A', quantity: 1 },
      ]),
    ).toEqual(['B', 'A']);
  });
});

describe('loadGameDeckById', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('happy path: 50-card deck with leader', async () => {
    const fakeDeck = {
      id: 'd1',
      name: 'My Deck',
      leaderCardId: 'OP01-001',
      cards: Array.from({ length: 13 }, (_, i) => ({
        cardId: `OP01-0${i + 10}`,
        quantity: 4,
      }))
        .slice(0, 12)
        .concat({ cardId: 'OP01-099', quantity: 2 }),
    };
    // 12 * 4 + 2 = 50
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(fakeDeck), { status: 200 })),
    );
    const r = await loadGameDeckById('d1', 'u1');
    expect(r.deck.length).toBe(50);
    expect(r.leaderCardId).toBe('OP01-001');
    expect(r.deckName).toBe('My Deck');
  });

  it('throws if deck has no leader', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ id: 'd', name: 'NoLeader', leaderCardId: null, cards: [] }),
            { status: 200 },
          ),
      ),
    );
    await expect(loadGameDeckById('d', 'u')).rejects.toThrow(/leader/i);
  });

  it('throws if deck total != 50', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              id: 'd',
              name: 'Short',
              leaderCardId: 'L',
              cards: [{ cardId: 'A', quantity: 1 }],
            }),
            { status: 200 },
          ),
      ),
    );
    await expect(loadGameDeckById('d', 'u')).rejects.toThrow(/50/);
  });

  it('throws on non-2xx HTTP', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('err', { status: 403 })),
    );
    await expect(loadGameDeckById('d', 'u')).rejects.toThrow(/403/);
  });
});
