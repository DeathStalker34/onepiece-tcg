'use client';

import { useState } from 'react';
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

  function handleAttach(
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Attach DON</DialogTitle>
          </DialogHeader>
          {open && (
            <AttachFlow
              available={donActive}
              leaderCardId={p.leader.cardId}
              characters={p.characters.map((c) => ({ instanceId: c.instanceId, cardId: c.cardId }))}
              onAttach={handleAttach}
              onCancel={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function AttachFlow({
  available,
  leaderCardId,
  characters,
  onAttach,
  onCancel,
}: {
  available: number;
  leaderCardId: string;
  characters: { instanceId: string; cardId: string }[];
  onAttach: (
    target: { kind: 'Leader' } | { kind: 'Character'; instanceId: string },
    n: number,
  ) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<number>(1);

  const toggle = (idx: number) => {
    // Click on a DON tile sets the selection to that many (1..available).
    setSelected((s) => (s === idx ? idx - 1 : idx));
  };

  return (
    <div className="space-y-4">
      {/* Step 1: DON selection */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide opacity-70">
            1. Select DON ({selected} / {available})
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setSelected(available)}
              disabled={selected === available}
            >
              All
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setSelected(0)}
              disabled={selected === 0}
            >
              Clear
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: available }).map((_, i) => {
            const idx = i + 1;
            const isSelected = idx <= selected;
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggle(idx)}
                className={`relative h-20 w-14 rounded-lg border-2 transition ${
                  isSelected
                    ? '-translate-y-1 border-amber-300 bg-gradient-to-br from-yellow-400 to-amber-600 shadow-lg shadow-amber-500/40'
                    : 'border-amber-900/40 bg-gradient-to-br from-yellow-700/50 to-stone-800/70 hover:-translate-y-0.5'
                }`}
                aria-label={`DON ${idx}`}
                aria-pressed={isSelected}
              >
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow">
                  DON!!
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Target */}
      <div>
        <div className="mb-2 text-xs uppercase tracking-wide opacity-70">2. Choose target</div>
        <div className="flex flex-wrap gap-3">
          <TargetTile
            cardId={leaderCardId}
            label="Leader"
            disabled={selected === 0}
            onPick={() => onAttach({ kind: 'Leader' }, selected)}
          />
          {characters.map((c) => (
            <TargetTile
              key={c.instanceId}
              cardId={c.cardId}
              label="Character"
              disabled={selected === 0}
              onPick={() => onAttach({ kind: 'Character', instanceId: c.instanceId }, selected)}
            />
          ))}
        </div>
        {selected === 0 && (
          <p className="mt-2 text-xs italic opacity-60">Select at least 1 DON to continue.</p>
        )}
      </div>

      <div className="flex justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function TargetTile({
  cardId,
  label,
  disabled,
  onPick,
}: {
  cardId: string;
  label: string;
  disabled: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1 rounded transition ${
        disabled ? 'opacity-40' : 'hover:scale-105 hover:ring-2 hover:ring-amber-400'
      }`}
      aria-label={`Attach to ${label}`}
    >
      <div className="relative aspect-[5/7] w-28 overflow-hidden rounded shadow-md">
        <Image
          src={cardImagePath(cardId)}
          alt={cardId}
          fill
          sizes="112px"
          className="object-cover"
        />
      </div>
      <span className="text-[10px] uppercase tracking-wide opacity-70">{label}</span>
    </button>
  );
}
