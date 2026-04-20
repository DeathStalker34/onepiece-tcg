'use client';

import Image from 'next/image';
import type { Card } from '@optcg/card-data';

interface Props {
  cards: Card[];
  deckCards: Array<{ cardId: string; quantity: number }>;
  leaderColors: string[];
  onAdd: (cardId: string) => void;
  onRemove: (cardId: string) => void;
  onInspect: (card: Card) => void;
}

export function CardGridBuilder({
  cards,
  deckCards,
  leaderColors,
  onAdd,
  onRemove,
  onInspect,
}: Props) {
  const qtyMap = new Map(deckCards.map((c) => [c.cardId, c.quantity]));

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {cards.map((card) => {
        const qty = qtyMap.get(card.id) ?? 0;
        const cardColors = card.colors.split(',').filter(Boolean);
        const matchesLeader =
          leaderColors.length === 0 || cardColors.some((c) => leaderColors.includes(c));

        return (
          <div
            key={card.id}
            className={`group relative aspect-[5/7] overflow-hidden rounded-md border ${matchesLeader ? '' : 'opacity-40'}`}
            title={matchesLeader ? card.name : `${card.name} — color mismatch`}
          >
            <button
              type="button"
              className="absolute inset-0 h-full w-full"
              onClick={() => onInspect(card)}
              aria-label={`Inspect ${card.name}`}
            >
              <Image
                src={card.imagePath}
                alt={card.name}
                fill
                sizes="(min-width:1280px) 16vw, (min-width:768px) 25vw, 50vw"
                className="object-cover"
              />
            </button>
            {qty > 0 && (
              <span className="pointer-events-none absolute right-1 top-1 rounded bg-black/80 px-1.5 py-0.5 text-xs text-white">
                {qty}/4
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 p-1 opacity-0 transition group-hover:opacity-100">
              <button
                type="button"
                className="rounded bg-white/20 px-2 text-white disabled:opacity-30"
                onClick={() => onRemove(card.id)}
                disabled={qty === 0}
              >
                −
              </button>
              <button
                type="button"
                className="rounded bg-white/20 px-2 text-white disabled:opacity-30"
                onClick={() => onAdd(card.id)}
                disabled={qty >= 4}
              >
                +
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
