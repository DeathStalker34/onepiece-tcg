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
  highlighted = false,
}: {
  char: CharacterInPlay;
  actions?: ActionMenuOption[];
  highlighted?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const clickable = actions.length > 0;

  function handleClick() {
    if (!clickable) return;
    if (actions.length === 1) {
      actions[0].onClick();
    } else {
      setOpen(true);
    }
  }

  return (
    <>
      <CardHoverPreview cardId={char.cardId}>
        <button
          type="button"
          onClick={handleClick}
          aria-disabled={!clickable}
          tabIndex={clickable ? 0 : -1}
          className={`relative aspect-[5/7] w-24 overflow-hidden rounded border border-amber-900/70 animate-in fade-in-0 slide-in-from-bottom-16 duration-500 ease-out transition-transform duration-700 ease-in-out ${char.rested ? 'rotate-90' : ''} ${char.summoningSickness ? 'opacity-60' : ''} ${clickable ? 'cursor-pointer hover:ring-2 hover:ring-primary' : 'cursor-default'} ${highlighted ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-stone-900 animate-pulse' : ''}`}
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
            <span
              key={char.attachedDon}
              className="absolute right-0.5 top-0.5 rounded bg-yellow-600 px-1 text-[9px] font-bold text-white animate-in zoom-in-50 duration-300"
            >
              +{char.attachedDon}
            </span>
          )}
        </button>
      </CardHoverPreview>
      {actions.length > 1 && (
        <ActionMenu
          title={`Character ${char.cardId}`}
          cardId={char.cardId}
          options={actions}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
