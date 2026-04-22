'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cardImagePath } from '@/lib/card-image';
import type { CharacterInPlay } from '@optcg/engine';
import { ActionMenu, type ActionMenuOption } from './action-menu';
import { CardHoverPreview } from './card-hover-preview';

export function CharacterCard({
  char,
  actions = [],
}: {
  char: CharacterInPlay;
  actions?: ActionMenuOption[];
}) {
  const [open, setOpen] = useState(false);
  const clickable = actions.length > 0;
  const visual = (
    <div
      className={`relative aspect-[5/7] w-24 overflow-hidden rounded border border-amber-900/70 transition-transform duration-200 ${char.rested ? 'rotate-90' : ''} ${char.summoningSickness ? 'opacity-60' : ''}`}
      title={`${char.cardId}${char.summoningSickness ? ' (summoning sickness)' : ''}`}
    >
      <Image
        src={cardImagePath(char.cardId)}
        alt={char.cardId}
        fill
        sizes="96px"
        className="object-cover"
      />
      {char.attachedDon > 0 && (
        <span className="absolute right-0.5 top-0.5 rounded bg-yellow-600 px-1 text-[9px] font-bold text-white">
          +{char.attachedDon}
        </span>
      )}
    </div>
  );

  if (!clickable) return <CardHoverPreview cardId={char.cardId}>{visual}</CardHoverPreview>;
  return (
    <>
      <CardHoverPreview cardId={char.cardId}>
        <button
          type="button"
          className="hover:ring-2 hover:ring-primary"
          onClick={() => {
            if (actions.length === 1) actions[0].onClick();
            else setOpen(true);
          }}
          aria-label={`Character ${char.cardId} actions`}
        >
          {visual}
        </button>
      </CardHoverPreview>
      {actions.length > 1 && (
        <ActionMenu
          title={`Character ${char.cardId}`}
          options={actions}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
