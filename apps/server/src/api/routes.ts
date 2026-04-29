import { randomInt, randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '@optcg/card-data/prisma';
import type { CardStatic, MatchSetup } from '@optcg/engine';

interface RouteDeps {
  catalog: Record<string, CardStatic>;
}

function getUserId(req: FastifyRequest): string | null {
  const v = req.headers['x-user-id'];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length > 0) return v[0];
  return null;
}

function requireUserId(req: FastifyRequest, reply: FastifyReply): string | null {
  const id = getUserId(req);
  if (!id) {
    reply.code(401).send({ error: 'missing x-user-id header' });
    return null;
  }
  return id;
}

const UserBody = z.object({ username: z.string().min(1).max(40) });
const DeckCreateBody = z.object({ name: z.string().min(1).max(120) });
const DeckUpdateBody = z.object({
  name: z.string().min(1).max(120),
  leaderCardId: z.string().nullable(),
  cards: z.array(z.object({ cardId: z.string().min(1), quantity: z.number().int().min(1).max(4) })),
});
const GameBody = z.object({
  seed: z.number().int().optional(),
  p0DeckId: z.string().min(1),
  p1DeckId: z.string().min(1),
});

function expandDeckCards(cards: Array<{ cardId: string; quantity: number }>): string[] {
  const out: string[] = [];
  for (const c of cards) for (let i = 0; i < c.quantity; i += 1) out.push(c.cardId);
  return out;
}

export async function registerApiRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  // ── /api/users ──────────────────────────────────────────────
  app.post('/api/users', async (req, reply) => {
    const parsed = UserBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid body' });
    const user = await prisma.user.upsert({
      where: { username: parsed.data.username },
      update: {},
      create: { username: parsed.data.username },
    });
    return reply.send({ id: user.id, username: user.username });
  });

  // ── /api/decks ──────────────────────────────────────────────
  app.get('/api/decks', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const decks = await prisma.deck.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { cards: true },
    });
    return reply.send(decks);
  });

  app.post('/api/decks', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const parsed = DeckCreateBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid body' });
    const deck = await prisma.deck.create({
      data: { userId, name: parsed.data.name },
      include: { cards: true },
    });
    return reply.code(201).send(deck);
  });

  // ── /api/decks/:id ──────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/api/decks/:id', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const deck = await prisma.deck.findUnique({
      where: { id: req.params.id },
      include: { cards: true },
    });
    if (!deck) return reply.code(404).send({ error: 'not found' });
    if (deck.userId !== userId) return reply.code(403).send({ error: 'forbidden' });
    return reply.send(deck);
  });

  app.put<{ Params: { id: string } }>('/api/decks/:id', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const parsed = DeckUpdateBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid body' });
    const existing = await prisma.deck.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.code(404).send({ error: 'not found' });
    if (existing.userId !== userId) return reply.code(403).send({ error: 'forbidden' });

    const { name, leaderCardId, cards } = parsed.data;
    const updated = await prisma.$transaction(async (tx) => {
      await tx.deckCard.deleteMany({ where: { deckId: req.params.id } });
      await tx.deck.update({
        where: { id: req.params.id },
        data: { name, leaderCardId },
      });
      if (cards.length > 0) {
        await tx.deckCard.createMany({
          data: cards.map((c) => ({
            deckId: req.params.id,
            cardId: c.cardId,
            quantity: c.quantity,
          })),
        });
      }
      return tx.deck.findUnique({
        where: { id: req.params.id },
        include: { cards: true },
      });
    });
    return reply.send(updated);
  });

  app.delete<{ Params: { id: string } }>('/api/decks/:id', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const existing = await prisma.deck.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.code(404).send({ error: 'not found' });
    if (existing.userId !== userId) return reply.code(403).send({ error: 'forbidden' });
    await prisma.deck.delete({ where: { id: req.params.id } });
    return reply.send({ ok: true });
  });

  // ── /api/games (returns a MatchSetup ready for the local hotseat/PvAI flow) ─
  app.post('/api/games', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const parsed = GameBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid body' });
    const { seed, p0DeckId, p1DeckId } = parsed.data;

    const [p0Deck, p1Deck] = await Promise.all([
      prisma.deck.findUnique({ where: { id: p0DeckId }, include: { cards: true } }),
      prisma.deck.findUnique({ where: { id: p1DeckId }, include: { cards: true } }),
    ]);
    if (!p0Deck || !p1Deck) return reply.code(404).send({ error: 'deck not found' });
    if (p0Deck.userId !== userId || p1Deck.userId !== userId) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    if (!p0Deck.leaderCardId || !p1Deck.leaderCardId) {
      return reply.code(400).send({ error: 'both decks must have a leader' });
    }

    const p0Cards = expandDeckCards(p0Deck.cards);
    const p1Cards = expandDeckCards(p1Deck.cards);
    if (p0Cards.length !== 50 || p1Cards.length !== 50) {
      return reply.code(400).send({
        error: `decks must have 50 cards (p0=${p0Cards.length}, p1=${p1Cards.length})`,
      });
    }

    // Validate every referenced cardId is in the static catalog
    const referenced = new Set([p0Deck.leaderCardId, p1Deck.leaderCardId, ...p0Cards, ...p1Cards]);
    for (const id of referenced) {
      if (!deps.catalog[id]) {
        return reply.code(400).send({ error: `card ${id} not found in catalog` });
      }
    }
    if (
      deps.catalog[p0Deck.leaderCardId].type !== 'LEADER' ||
      deps.catalog[p1Deck.leaderCardId].type !== 'LEADER'
    ) {
      return reply.code(400).send({ error: 'leader card is not a LEADER type' });
    }

    const finalSeed = seed ?? randomInt(0, 2 ** 31 - 1);
    const setup: MatchSetup = {
      seed: finalSeed,
      firstPlayer: 0,
      players: [
        { playerId: p0Deck.id, leaderCardId: p0Deck.leaderCardId, deck: p0Cards },
        { playerId: p1Deck.id, leaderCardId: p1Deck.leaderCardId, deck: p1Cards },
      ],
      catalog: deps.catalog,
    };
    return reply.code(201).send({ gameId: randomUUID(), setup });
  });
}
