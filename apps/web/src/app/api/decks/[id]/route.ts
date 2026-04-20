import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@optcg/card-data';
import { requireUserId } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UpdateSchema = z.object({
  name: z.string().min(1).max(120),
  leaderCardId: z.string().nullable(),
  cards: z.array(
    z.object({
      cardId: z.string().min(1),
      quantity: z.number().int().min(1).max(4),
    }),
  ),
});

async function deckGuard(id: string, userId: string) {
  const deck = await prisma.deck.findUnique({ where: { id } });
  if (!deck) return { error: NextResponse.json({ error: 'not found' }, { status: 404 }) };
  if (deck.userId !== userId) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { deck };
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const userIdOrRes = requireUserId(req);
  if (typeof userIdOrRes !== 'string') return userIdOrRes;

  const g = await deckGuard(ctx.params.id, userIdOrRes);
  if ('error' in g) return g.error;

  const deck = await prisma.deck.findUnique({
    where: { id: ctx.params.id },
    include: { cards: true },
  });
  return NextResponse.json(deck);
}

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  const userIdOrRes = requireUserId(req);
  if (typeof userIdOrRes !== 'string') return userIdOrRes;
  const g = await deckGuard(ctx.params.id, userIdOrRes);
  if ('error' in g) return g.error;

  const parsed = UpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const { name, leaderCardId, cards } = parsed.data;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.deckCard.deleteMany({ where: { deckId: ctx.params.id } });
    await tx.deck.update({
      where: { id: ctx.params.id },
      data: { name, leaderCardId },
    });
    if (cards.length > 0) {
      await tx.deckCard.createMany({
        data: cards.map((c) => ({
          deckId: ctx.params.id,
          cardId: c.cardId,
          quantity: c.quantity,
        })),
      });
    }
    return tx.deck.findUnique({
      where: { id: ctx.params.id },
      include: { cards: true },
    });
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const userIdOrRes = requireUserId(req);
  if (typeof userIdOrRes !== 'string') return userIdOrRes;
  const g = await deckGuard(ctx.params.id, userIdOrRes);
  if ('error' in g) return g.error;

  await prisma.deck.delete({ where: { id: ctx.params.id } });
  return NextResponse.json({ ok: true });
}
