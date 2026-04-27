import { NextResponse } from 'next/server';
import cardsData from '@/data/cards.json';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(cardsData);
}
