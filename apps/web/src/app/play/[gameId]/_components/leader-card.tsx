'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cardImagePath } from '@/lib/card-image';
import type { LeaderInPlay } from '@optcg/engine';
import { ActionMenu, type ActionMenuOption } from './action-menu';
import { CardHoverPreview } from './card-hover-preview';

export function LeaderCard({
  leader,
  lifeCount,
  actions = [],
  highlighted = false,
  effectivePower,
  basePower,
}: {
  leader: LeaderInPlay;
  lifeCount: number;
  actions?: ActionMenuOption[];
  highlighted?: boolean;
  effectivePower: number;
  basePower: number;
}) {
  const [open, setOpen] = useState(false);
  const clickable = actions.length > 0;
  const powerDelta = effectivePower - basePower;
  const isBuffed = powerDelta > 0;
  const isDebuffed = powerDelta < 0;
  const glow = isBuffed
    ? 'shadow-[0_0_18px_rgba(252,211,77,0.8)]'
    : isDebuffed
      ? 'shadow-[0_0_12px_rgba(220,38,38,0.65)]'
      : '';

  function handleClick() {
    if (!clickable) return;
    if (actions.length === 1) {
      actions[0].onClick();
    } else {
      setOpen(true);
    }
  }

  return (
    <div className="relative">
      <CardHoverPreview cardId={leader.cardId}>
        <button
          type="button"
          onClick={handleClick}
          aria-disabled={!clickable}
          tabIndex={clickable ? 0 : -1}
          className={`relative aspect-[5/7] w-32 overflow-hidden rounded border-2 border-amber-900/70 transition-transform duration-700 ease-in-out ${leader.rested ? 'rotate-90' : ''} ${clickable ? 'cursor-pointer hover:ring-2 hover:ring-primary' : 'cursor-default'} ${highlighted ? 'ring-4 ring-amber-300 ring-offset-2 ring-offset-stone-900 shadow-[0_0_20px_rgba(252,211,77,0.95)]' : ''} ${glow}`}
          aria-label={`Leader ${leader.cardId}`}
        >
          <Image
            src={cardImagePath(leader.cardId)}
            alt={leader.cardId}
            fill
            sizes="128px"
            className="object-cover"
          />
          {leader.attachedDon > 0 && (
            <span
              key={leader.attachedDon}
              className="absolute right-1 top-1 rounded bg-yellow-600 px-1 text-[10px] font-bold text-white animate-in zoom-in-50 duration-300"
            >
              +{leader.attachedDon} DON
            </span>
          )}
          <span
            className={`absolute bottom-1 right-1 rounded px-1.5 py-0.5 text-xs font-bold transition-colors ${
              isBuffed
                ? 'bg-yellow-400 text-stone-900'
                : isDebuffed
                  ? 'bg-red-700 text-white'
                  : 'bg-stone-900/85 text-amber-100'
            }`}
            aria-label={`Power ${effectivePower}`}
          >
            {effectivePower}
          </span>
        </button>
      </CardHoverPreview>

      {/* Life badge — absolute overlay OUTSIDE the rotating button */}
      <div
        key={lifeCount}
        className="absolute -bottom-2 -left-2 z-20 flex h-10 w-10 items-center justify-center rounded-full border-2 border-amber-200 bg-red-800 text-base font-bold text-white shadow-lg animate-in zoom-in-75 duration-300"
        aria-label={`${lifeCount} life`}
      >
        {lifeCount}
      </div>

      {actions.length > 1 && (
        <ActionMenu
          title={`Leader ${leader.cardId}`}
          cardId={leader.cardId}
          options={actions}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </div>
  );
}
