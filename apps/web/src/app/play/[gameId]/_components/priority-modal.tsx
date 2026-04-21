'use client';

import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cardImagePath } from '@/lib/card-image';
import { useGame } from './game-provider';

export function PriorityModal() {
  const { state, dispatch } = useGame();
  const pw = state.priorityWindow;

  if (!pw) return null;

  switch (pw.kind) {
    case 'Mulligan':
      return <MulliganVariant />;
    // CounterStep / BlockerStep / TriggerStep — Task 11
    default:
      return null;
  }

  function MulliganVariant() {
    if (pw?.kind !== 'Mulligan') return null;
    const player = pw.player;
    const hand = state.players[player].hand;

    function choose(mulligan: boolean) {
      dispatch({ kind: 'Mulligan', player, mulligan });
    }

    return (
      <Dialog open modal>
        <DialogContent className="max-w-3xl" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Player {player} — Mulligan?</DialogTitle>
            <DialogDescription>
              You drew 5 cards. Keep them or redraw 5 new cards (you can only mulligan once).
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 overflow-x-auto py-2">
            {hand.map((cardId, i) => (
              <div
                key={`${cardId}-${i}`}
                className="relative aspect-[5/7] w-24 shrink-0 overflow-hidden rounded border border-amber-900/60"
              >
                <Image
                  src={cardImagePath(cardId)}
                  alt={cardId}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => choose(true)}>
              Mulligan
            </Button>
            <Button onClick={() => choose(false)}>Keep</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
}
