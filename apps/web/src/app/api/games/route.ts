import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomInt, randomUUID } from 'node:crypto';
import { prisma } from '@optcg/card-data';
import type { MatchSetup } from '@optcg/engine';
import { buildCatalog } from '@/lib/catalog-builder';
import { expandDeckCards } from '@/lib/deck-loader';
import { requireUserId } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  seed: z.number().int().optional(),
  p0DeckId: z.string().min(1),
  p1DeckId: z.string().min(1),
});

export async function POST(req: Request) {
  const userIdOrRes = requireUserId(req);
  if (typeof userIdOrRes !== 'string') return userIdOrRes;
  const userId = userIdOrRes;

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const { seed, p0DeckId, p1DeckId } = parsed.data;

  // Load both decks with ownership
  const [p0Deck, p1Deck] = await Promise.all([
    prisma.deck.findUnique({ where: { id: p0DeckId }, include: { cards: true } }),
    prisma.deck.findUnique({ where: { id: p1DeckId }, include: { cards: true } }),
  ]);

  if (!p0Deck || !p1Deck) {
    return NextResponse.json({ error: 'deck not found' }, { status: 404 });
  }
  if (p0Deck.userId !== userId || p1Deck.userId !== userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!p0Deck.leaderCardId || !p1Deck.leaderCardId) {
    return NextResponse.json({ error: 'both decks must have a leader' }, { status: 400 });
  }

  const p0Cards = expandDeckCards(
    p0Deck.cards.map((c) => ({ cardId: c.cardId, quantity: c.quantity })),
  );
  const p1Cards = expandDeckCards(
    p1Deck.cards.map((c) => ({ cardId: c.cardId, quantity: c.quantity })),
  );

  if (p0Cards.length !== 50 || p1Cards.length !== 50) {
    return NextResponse.json(
      { error: `decks must have 50 cards (p0=${p0Cards.length}, p1=${p1Cards.length})` },
      { status: 400 },
    );
  }

  // Load all referenced cards + both leaders from DB
  const referencedIds = new Set([p0Deck.leaderCardId, p1Deck.leaderCardId, ...p0Cards, ...p1Cards]);
  const cardRows = await prisma.card.findMany({ where: { id: { in: [...referencedIds] } } });

  const foundIds = new Set(cardRows.map((c) => c.id));
  for (const id of referencedIds) {
    if (!foundIds.has(id)) {
      return NextResponse.json({ error: `card ${id} not found in catalog` }, { status: 400 });
    }
  }

  const catalog = buildCatalog(cardRows);
  if (!catalog[p0Deck.leaderCardId] || !catalog[p1Deck.leaderCardId]) {
    return NextResponse.json({ error: 'leader card missing from catalog' }, { status: 500 });
  }
  if (
    catalog[p0Deck.leaderCardId].type !== 'LEADER' ||
    catalog[p1Deck.leaderCardId].type !== 'LEADER'
  ) {
    return NextResponse.json({ error: 'leader card is not a LEADER type' }, { status: 400 });
  }

  const finalSeed = seed ?? randomInt(0, 2 ** 31 - 1);

  const setup: MatchSetup = {
    seed: finalSeed,
    firstPlayer: 0,
    players: [
      { playerId: p0Deck.id, leaderCardId: p0Deck.leaderCardId, deck: p0Cards },
      { playerId: p1Deck.id, leaderCardId: p1Deck.leaderCardId, deck: p1Cards },
    ],
    catalog,
  };

  return NextResponse.json({ gameId: randomUUID(), setup }, { status: 201 });
}
