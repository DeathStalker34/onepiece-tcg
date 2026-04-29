'use client';

import Image from 'next/image';
import { cardImagePath } from '@/lib/card-image';

export function CardDragOverlay({ cardId }: { cardId: string | null }) {
  if (!cardId) return null;
  return (
    <div className="pointer-events-none relative aspect-[5/7] w-24 rotate-3 overflow-hidden rounded border border-amber-900/60 shadow-2xl">
      <Image src={cardImagePath(cardId)} alt={cardId} fill sizes="96px" className="object-cover" />
    </div>
  );
}

export function DonDragOverlay() {
  return (
    <div className="pointer-events-none h-16 w-12 rotate-3 rounded border border-yellow-600 bg-gradient-to-br from-yellow-500 to-yellow-700 shadow-2xl" />
  );
}
