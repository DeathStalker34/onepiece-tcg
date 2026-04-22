'use client';

import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cardImagePath } from '@/lib/card-image';

interface Props {
  title: string;
  cards: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PileViewer({ title, cards, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {cards.length === 0 ? 'Empty.' : `${cards.length} card(s)`}
          </DialogDescription>
        </DialogHeader>
        {cards.length > 0 && (
          <div className="grid max-h-[70vh] grid-cols-4 gap-3 overflow-y-auto md:grid-cols-6">
            {cards.map((cardId, i) => (
              <div
                key={`${cardId}-${i}`}
                className="relative aspect-[5/7] w-full overflow-hidden rounded border border-amber-900/60"
                title={cardId}
              >
                <Image
                  src={cardImagePath(cardId)}
                  alt={cardId}
                  fill
                  sizes="160px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
