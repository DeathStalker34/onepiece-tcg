'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useDraggable } from '@dnd-kit/core';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cardImagePath } from '@/lib/card-image';
import { useGame } from './game-provider';

function DraggableDonTile({ index, disabled }: { index: number; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `don:${index}`,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`h-16 w-12 rounded border border-yellow-600 bg-gradient-to-br from-yellow-500 to-yellow-700 shadow ${disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} ${isDragging ? 'opacity-40' : ''}`}
      aria-label={`DON ${index + 1}`}
    />
  );
}

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
          <div className="flex gap-0.5">
            {donActive === 0 ? (
              <div className="h-16 w-12 rounded border border-yellow-700/40 bg-stone-800/50" />
            ) : (
              <>
                {Array.from({ length: Math.min(donActive, 5) }).map((_, i) => (
                  <DraggableDonTile key={i} index={i} disabled={!canAttach} />
                ))}
                {donActive > 5 && (
                  <span className="ml-1 self-center text-xs font-bold text-yellow-200">
                    +{donActive - 5}
                  </span>
                )}
              </>
            )}
          </div>
          <span className="text-[10px] uppercase text-yellow-300">Active ({donActive})</span>
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
                className={`transition ${
                  isSelected
                    ? '-translate-y-1 drop-shadow-[0_4px_12px_rgba(245,158,11,0.55)]'
                    : 'opacity-60 hover:-translate-y-0.5 hover:opacity-100'
                }`}
                aria-label={`DON ${idx}`}
                aria-pressed={isSelected}
              >
                <DonCardGlyph />
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
        disabled ? 'opacity-40' : 'hover:scale-105'
      }`}
      aria-label={`Attach to ${label}`}
    >
      <div className="relative aspect-[5/7] w-40 overflow-hidden rounded shadow-md">
        <Image
          src={cardImagePath(cardId)}
          alt={cardId}
          fill
          sizes="160px"
          className="object-cover"
        />
      </div>
      <span className="text-[10px] uppercase tracking-wide opacity-70">{label}</span>
    </button>
  );
}

function DonCardGlyph() {
  return (
    <svg
      viewBox="0 0 100 140"
      className="h-24 w-[68px] rounded-lg"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <radialGradient id="don-bg" cx="50%" cy="45%" r="70%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="55%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#78350f" />
        </radialGradient>
        <radialGradient id="don-sphere" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fffbeb" />
          <stop offset="60%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#78350f" />
        </radialGradient>
      </defs>
      <rect
        x="2"
        y="2"
        width="96"
        height="136"
        rx="8"
        fill="url(#don-bg)"
        stroke="#78350f"
        strokeWidth="2"
      />
      <g opacity="0.9">
        <circle cx="50" cy="48" r="18" fill="url(#don-sphere)" />
        <circle cx="30" cy="70" r="18" fill="url(#don-sphere)" />
        <circle cx="70" cy="70" r="18" fill="url(#don-sphere)" />
        <circle cx="50" cy="92" r="18" fill="url(#don-sphere)" />
      </g>
      <rect
        x="14"
        y="112"
        width="72"
        height="18"
        rx="3"
        fill="#7f1d1d"
        stroke="#450a0a"
        strokeWidth="1"
      />
      <text
        x="50"
        y="125"
        textAnchor="middle"
        fontSize="13"
        fontWeight="900"
        fill="#fef3c7"
        fontFamily="system-ui, sans-serif"
      >
        DON!!
      </text>
    </svg>
  );
}
