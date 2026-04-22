'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useGame } from './game-provider';

interface Props {
  playerIndex: 0 | 1;
}

export function DonStack({ playerIndex }: Props) {
  const { state, dispatch } = useGame();
  const [open, setOpen] = useState(false);

  const p = state.players[playerIndex];
  const { donActive, donRested, donDeck } = p;

  const canAttach =
    state.activePlayer === playerIndex &&
    state.phase === 'Main' &&
    state.priorityWindow === null &&
    donActive > 0;

  return (
    <>
      <button
        type="button"
        className={`zone-frame flex items-center gap-3 p-3 ${canAttach ? 'cursor-pointer hover:bg-amber-900/30' : 'cursor-default'}`}
        onClick={() => canAttach && setOpen(true)}
        disabled={!canAttach}
        aria-label="Don pool"
      >
        <div className="flex flex-col items-center gap-1">
          <div className="relative h-16 w-12">
            {donActive === 0 ? (
              <div className="h-16 w-12 rounded border border-yellow-700/40 bg-stone-800/50" />
            ) : (
              <>
                {Array.from({ length: Math.min(donActive, 3) }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute h-16 w-12 rounded border border-yellow-600 bg-gradient-to-br from-yellow-500 to-yellow-700 shadow"
                    style={{ top: `-${i * 2}px`, left: `-${i * 1}px`, zIndex: i }}
                    aria-hidden
                  />
                ))}
                <span className="absolute inset-0 z-10 flex items-center justify-center text-sm font-bold text-white drop-shadow">
                  {donActive}
                </span>
              </>
            )}
          </div>
          <span className="text-[10px] uppercase text-yellow-300">Active</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="relative h-16 w-12">
            {donRested === 0 ? (
              <div className="h-16 w-12 rounded border border-yellow-900/40 bg-stone-800/30" />
            ) : (
              <>
                {Array.from({ length: Math.min(donRested, 3) }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute h-12 w-16 rotate-90 rounded border border-yellow-800 bg-gradient-to-br from-yellow-700 to-stone-800 shadow"
                    style={{ top: `${i * 2}px`, left: `${-i * 1}px`, zIndex: i }}
                    aria-hidden
                  />
                ))}
                <span className="absolute inset-0 z-10 flex items-center justify-center text-sm font-bold text-white drop-shadow">
                  {donRested}
                </span>
              </>
            )}
          </div>
          <span className="text-[10px] uppercase opacity-70">Rested</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="relative h-16 w-12">
            {donDeck === 0 ? (
              <div className="h-16 w-12 rounded border border-stone-700 bg-stone-800/50" />
            ) : (
              <>
                {Array.from({ length: Math.min(donDeck, 4) }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute h-16 w-12 rounded border border-stone-600 bg-gradient-to-br from-stone-700 to-stone-900 shadow"
                    style={{ top: `-${i * 2}px`, left: `-${i * 1}px`, zIndex: i }}
                    aria-hidden
                  />
                ))}
                <span className="absolute inset-0 z-10 flex items-center justify-center text-sm font-bold text-white drop-shadow">
                  {donDeck}
                </span>
              </>
            )}
          </div>
          <span className="text-[10px] uppercase opacity-70">Deck</span>
        </div>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Attach DON</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                dispatch({
                  kind: 'AttachDon',
                  player: playerIndex,
                  target: { kind: 'Leader' },
                });
                setOpen(false);
              }}
            >
              Attach 1 to Leader
            </Button>
            {p.characters.map((c) => (
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
                Attach 1 to {c.cardId}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
