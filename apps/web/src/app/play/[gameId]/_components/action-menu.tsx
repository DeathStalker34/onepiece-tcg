'use client';

import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cardImagePath } from '@/lib/card-image';

export interface ActionMenuOption {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function ActionMenu({
  title,
  cardId,
  options,
  open,
  onOpenChange,
}: {
  title: string;
  cardId?: string;
  options: ActionMenuOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-3">
          {cardId && (
            <div className="relative aspect-[5/7] w-24 shrink-0 overflow-hidden rounded border border-amber-900/60">
              <Image
                src={cardImagePath(cardId)}
                alt={cardId}
                fill
                sizes="96px"
                className="object-cover"
              />
            </div>
          )}
          <div className="flex flex-1 flex-col gap-2">
            {options.map((opt) => (
              <Button
                key={opt.label}
                variant="secondary"
                disabled={opt.disabled}
                onClick={() => {
                  opt.onClick();
                  onOpenChange(false);
                }}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
