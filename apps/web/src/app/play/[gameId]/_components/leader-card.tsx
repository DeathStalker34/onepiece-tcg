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
}: {
  leader: LeaderInPlay;
  lifeCount: number;
  actions?: ActionMenuOption[];
}) {
  const [open, setOpen] = useState(false);
  const clickable = actions.length > 0;

  const visual = (
    <div
      className={`relative aspect-[5/7] w-32 overflow-hidden rounded border-2 border-amber-900/70 transition-transform duration-300 ease-out ${leader.rested ? 'rotate-90' : ''}`}
    >
      <Image
        src={cardImagePath(leader.cardId)}
        alt={leader.cardId}
        fill
        sizes="128px"
        className="object-cover"
      />
      {leader.attachedDon > 0 && (
        <span className="absolute right-1 top-1 rounded bg-yellow-600 px-1 text-[10px] font-bold text-white">
          +{leader.attachedDon} DON
        </span>
      )}
      {leader.powerThisTurn !== 0 && (
        <span className="absolute bottom-1 left-1 rounded bg-red-600 px-1 text-[10px] font-bold text-white">
          {leader.powerThisTurn > 0 ? '+' : ''}
          {leader.powerThisTurn}
        </span>
      )}
    </div>
  );

  const inner = clickable ? (
    <button
      type="button"
      className="transition-transform hover:scale-105 hover:ring-2 hover:ring-primary"
      onClick={() => {
        if (actions.length === 1) {
          actions[0].onClick();
        } else {
          setOpen(true);
        }
      }}
      aria-label={`Leader ${leader.cardId} actions`}
    >
      {visual}
    </button>
  ) : (
    visual
  );

  return (
    <div className="flex items-center gap-2">
      <CardHoverPreview cardId={leader.cardId}>{inner}</CardHoverPreview>
      <div className="text-center">
        <div className="zone-label">Life</div>
        <div className="text-3xl font-bold leading-none">{lifeCount}</div>
      </div>
      {actions.length > 1 && (
        <ActionMenu
          title={`Leader ${leader.cardId}`}
          options={actions}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </div>
  );
}
