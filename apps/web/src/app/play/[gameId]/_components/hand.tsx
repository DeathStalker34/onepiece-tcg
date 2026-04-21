'use client';

import Image from 'next/image';
import { cardImagePath } from '@/lib/card-image';

export function Hand({
  cards,
  hidden = false,
  label,
}: {
  cards: string[];
  hidden?: boolean;
  label: string;
}) {
  if (hidden) {
    return (
      <div className="zone-frame flex items-center gap-3 p-3">
        <div className="zone-label">{label}</div>
        <div className="flex items-center gap-1">
          {cards.slice(0, Math.min(cards.length, 10)).map((_, i) => (
            <div
              key={i}
              className="aspect-[5/7] w-10 rounded border border-amber-900/60 bg-stone-800"
              aria-hidden
            />
          ))}
        </div>
        <span className="text-xs opacity-70">{cards.length} cards</span>
      </div>
    );
  }
  return (
    <div className="zone-frame flex items-center gap-2 overflow-x-auto p-3">
      <div className="zone-label shrink-0">{label}</div>
      {cards.length === 0 ? (
        <span className="text-xs italic opacity-50">empty</span>
      ) : (
        cards.map((cardId, i) => (
          <div
            key={`${cardId}-${i}`}
            className="relative aspect-[5/7] w-16 shrink-0 overflow-hidden rounded border border-amber-900/60"
          >
            <Image
              src={cardImagePath(cardId)}
              alt={cardId}
              fill
              sizes="64px"
              className="object-cover"
            />
          </div>
        ))
      )}
    </div>
  );
}
