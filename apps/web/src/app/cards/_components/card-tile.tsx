'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { Card } from '@optcg/card-data';
import { CardDetailDialog } from './card-detail-dialog';

export function CardTile({ card }: { card: Card }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative aspect-[5/7] w-full overflow-hidden rounded-md border bg-muted transition hover:ring-2 hover:ring-primary focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label={`Open details for ${card.name}`}
      >
        <Image
          src={card.imagePath}
          alt={card.name}
          fill
          sizes="(min-width:1024px) 16vw, (min-width:768px) 25vw, 50vw"
          className="object-cover"
        />
      </button>
      <CardDetailDialog card={card} open={open} onOpenChange={setOpen} />
    </>
  );
}
