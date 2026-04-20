import { NextResponse } from 'next/server';
import { prisma } from '@optcg/card-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const cards = await prisma.card.findMany({ orderBy: { id: 'asc' } });
  return NextResponse.json(cards);
}
