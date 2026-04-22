'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cardImagePath } from '@/lib/card-image';
import { useGame } from './game-provider';

interface Props {
  playerIndex: 0 | 1;
}

export function DonStack({ playerIndex }: Props) {
  const { state, dispatchBatch } = useGame();
  const [open, setOpen] = useState(false);

  const p = state.players[playerIndex];
  const { donActive, donRested, donDeck } = p;

  const canAttach =
    state.activePlayer === playerIndex &&
    state.phase === 'Main' &&
    state.priorityWindow === null &&
    donActive > 0;

  function attachTo(
    target: { kind: 'Leader' } | { kind: 'Character'; instanceId: string },
    n: number,
  ) {
    if (n <= 0) return;
    const actions = Array.from({ length: n }, () => ({
      kind: 'AttachDon' as const,
      player: playerIndex,
      target,
    }));
    dispatchBatch(actions);
    setOpen(false);
  }

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
                <span
                  key={donActive}
                  className="absolute inset-0 z-10 flex items-center justify-center text-sm font-bold text-white drop-shadow animate-in zoom-in-75 duration-300"
                >
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
                <span
                  key={donRested}
                  className="absolute inset-0 z-10 flex items-center justify-center text-sm font-bold text-white drop-shadow animate-in zoom-in-75 duration-300"
                >
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
                <span
                  key={donDeck}
                  className="absolute inset-0 z-10 flex items-center justify-center text-sm font-bold text-white drop-shadow animate-in zoom-in-75 duration-300"
                >
                  {donDeck}
                </span>
              </>
            )}
          </div>
          <span className="text-[10px] uppercase opacity-70">Deck</span>
        </div>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Attach DON</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <AttachRow
              cardId={p.leader.cardId}
              label="Leader"
              available={p.donActive}
              onAttach={(n) => attachTo({ kind: 'Leader' }, n)}
            />
            {p.characters.map((c) => (
              <AttachRow
                key={c.instanceId}
                cardId={c.cardId}
                label={c.cardId}
                available={p.donActive}
                onAttach={(n) => attachTo({ kind: 'Character', instanceId: c.instanceId }, n)}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AttachRow({
  cardId,
  label,
  available,
  onAttach,
}: {
  cardId: string;
  label: string;
  available: number;
  onAttach: (n: number) => void;
}) {
  const [count, setCount] = useState(1);

  useEffect(() => {
    if (count > available) {
      setCount(Math.max(1, available));
    }
  }, [available, count]);

  const canAttach = available >= 1 && count >= 1 && count <= available;

  return (
    <div className="flex items-center gap-3 rounded border p-2 text-sm">
      <div className="relative aspect-[5/7] w-14 shrink-0 overflow-hidden rounded border border-amber-900/60">
        <Image
          src={cardImagePath(cardId)}
          alt={cardId}
          fill
          sizes="56px"
          className="object-cover"
        />
      </div>
      <span className="flex-1 truncate text-xs">{label}</span>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="secondary"
          disabled={count <= 1}
          onClick={() => setCount((n) => Math.max(1, n - 1))}
          aria-label="Decrease"
        >
          −
        </Button>
        <span className="w-6 text-center text-sm tabular-nums">{count}</span>
        <Button
          size="sm"
          variant="secondary"
          disabled={count >= available}
          onClick={() => setCount((n) => Math.min(available, n + 1))}
          aria-label="Increase"
        >
          +
        </Button>
        <Button size="sm" disabled={!canAttach} onClick={() => onAttach(count)} className="ml-2">
          Attach
        </Button>
      </div>
    </div>
  );
}
