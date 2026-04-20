import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@optcg/card-data';
import { requireUserId } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateSchema = z.object({ name: z.string().min(1).max(120) });

export async function POST(req: Request) {
  const userIdOrRes = requireUserId(req);
  if (typeof userIdOrRes !== 'string') return userIdOrRes;
  const userId = userIdOrRes;

  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const deck = await prisma.deck.create({
    data: { userId, name: parsed.data.name },
    include: { cards: true },
  });
  return NextResponse.json(deck, { status: 201 });
}

export async function GET(req: Request) {
  const userIdOrRes = requireUserId(req);
  if (typeof userIdOrRes !== 'string') return userIdOrRes;

  const decks = await prisma.deck.findMany({
    where: { userId: userIdOrRes },
    orderBy: { updatedAt: 'desc' },
    include: { cards: true },
  });
  return NextResponse.json(decks);
}
