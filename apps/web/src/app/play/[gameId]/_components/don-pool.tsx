'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useGame } from './game-provider';

interface Props {
  active: number;
  rested: number;
  donDeck: number;
  compact?: boolean;
  playerIndex: 0 | 1;
}

export function DonPool({ active, rested, donDeck, compact = false, playerIndex }: Props) {
  const { state, dispatch } = useGame();
  const [open, setOpen] = useState(false);

  const max = active + rested;
  const canAttach =
    state.activePlayer === playerIndex &&
    state.phase === 'Main' &&
    state.priorityWindow === null &&
    active > 0;

  function attachToLeader() {
    dispatch({ kind: 'AttachDon', player: playerIndex, target: { kind: 'Leader' } });
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className={`zone-frame w-full space-y-1 p-2 text-left ${canAttach ? 'hover:bg-amber-900/30' : ''}`}
        onClick={() => canAttach && setOpen(true)}
        disabled={!canAttach}
        aria-label="Don pool"
      >
        <div className="zone-label">DON</div>
        {compact ? (
          <div className="text-xs">
            <span className="font-bold text-yellow-300">{active}</span> /{' '}
            <span className="opacity-70">{max}</span>
            <span className="ml-2 opacity-60">deck: {donDeck}</span>
          </div>
        ) : (
          <div className="space-y-1 text-xs">
            <div>
              Active: <span className="font-bold text-yellow-300">{active}</span>
            </div>
            <div>
              Rested: <span className="opacity-70">{rested}</span>
            </div>
            <div className="opacity-60">DON deck: {donDeck}</div>
          </div>
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Attach DON</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button variant="secondary" onClick={attachToLeader}>
              Attach to Leader
            </Button>
            {state.players[playerIndex].characters.map((c) => (
              <Button
                key={c.instanceId}
                variant="secondary"
                onClick={() => {
                  dispatch({
                    kind: 'AttachDon',
                    player: playerIndex,
                    target: { kind: 'Character', instanceId: c.instanceId },
                  });
                  setOpen(false);
                }}
              >
                Attach to {c.cardId}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
