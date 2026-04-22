'use client';

import Image from 'next/image';
import { cardImagePath } from '@/lib/card-image';
import type { ReactNode } from 'react';

interface Props {
  cardId: string;
  children: ReactNode;
}

export function CardHoverPreview({ cardId, children }: Props) {
  return (
    <span className="group relative inline-block">
      {children}
      <span
        className="pointer-events-none absolute left-1/2 top-0 z-50 hidden -translate-x-1/2 -translate-y-full pb-2 group-hover:block"
        aria-hidden
      >
        <span className="block rounded border-2 border-amber-600 bg-stone-900/95 p-1 shadow-2xl">
          <span className="relative block aspect-[5/7] w-56 overflow-hidden rounded">
            <Image
              src={cardImagePath(cardId)}
              alt=""
              fill
              sizes="224px"
              className="object-contain"
            />
          </span>
        </span>
      </span>
    </span>
  );
}
