'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cardImagePath } from '@/lib/card-image';

interface Props {
  cardId: string;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export function CardHoverPreview({ cardId, children, side = 'top' }: Props) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block">{children}</span>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          sideOffset={6}
          className="border-2 border-amber-600 bg-stone-900/95 p-1 shadow-2xl data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=delayed-open]:zoom-in-95"
        >
          <div className="relative aspect-[5/7] w-80 overflow-hidden rounded">
            <Image
              src={cardImagePath(cardId)}
              alt={cardId}
              fill
              sizes="320px"
              className="object-contain"
            />
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
