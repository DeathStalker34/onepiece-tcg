import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@optcg/card-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({ username: z.string().min(1).max(40) });

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const { username } = parsed.data;

  const user = await prisma.user.upsert({
    where: { username },
    update: {},
    create: { username },
  });

  return NextResponse.json({ id: user.id, username: user.username }, { status: 200 });
}
