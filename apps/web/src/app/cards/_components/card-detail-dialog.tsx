'use client';

import Image from 'next/image';
import type { Card } from '@optcg/card-data';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

interface Props {
  card: Card | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CardDetailDialog({ card, open, onOpenChange }: Props) {
  if (!card) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{card.name}</DialogTitle>
          <DialogDescription>
            {card.id} · {card.setName} · {card.rarity}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          <div className="relative aspect-[5/7] w-full overflow-hidden rounded-md">
            <Image
              src={card.imagePath}
              alt={card.name}
              fill
              sizes="280px"
              className="object-contain"
            />
          </div>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <Field label="Type" value={card.type} />
              <Field label="Colors" value={card.colors.split(',').filter(Boolean).join(' / ')} />
              {card.cost !== null && <Field label="Cost" value={String(card.cost)} />}
              {card.power !== null && <Field label="Power" value={String(card.power)} />}
              {card.counter !== null && <Field label="Counter" value={String(card.counter)} />}
              {card.life !== null && <Field label="Life" value={String(card.life)} />}
              {card.attributes && (
                <Field
                  label="Attributes"
                  value={card.attributes.split(',').filter(Boolean).join(' / ')}
                />
              )}
            </div>
            <Separator />
            {card.effectText && (
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">Effect</div>
                <p className="whitespace-pre-wrap">{card.effectText}</p>
              </div>
            )}
            {card.triggerText && (
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">Trigger</div>
                <p className="whitespace-pre-wrap">{card.triggerText}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  );
}
