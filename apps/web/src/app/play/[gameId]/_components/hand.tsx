'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cardImagePath } from '@/lib/card-image';
import { useGame } from './game-provider';
import { ActionMenu, type ActionMenuOption } from './action-menu';
import { CardHoverPreview } from './card-hover-preview';
import type { CardType } from '@optcg/engine';

export function Hand({
  cards,
  hidden = false,
  clickable = false,
  playerIndex,
}: {
  cards: string[];
  hidden?: boolean;
  clickable?: boolean;
  playerIndex: 0 | 1;
}) {
  const { state, dispatch } = useGame();
  const [selected, setSelected] = useState<{ cardId: string; handIndex: number } | null>(null);

  if (hidden) {
    // Single card-back with count overlay
    return (
      <div className="flex items-center justify-center p-3">
        <div className="relative aspect-[5/7] w-20">
          {cards.length === 0 ? (
            <div className="h-full w-full rounded border border-amber-900/40 bg-stone-900/20" />
          ) : (
            <>
              {Array.from({ length: Math.min(cards.length, 4) }).map((_, i) => (
                <div
                  key={i}
                  className="absolute h-full w-full rounded border-2 border-amber-800/80 bg-gradient-to-br from-amber-900 to-stone-900 shadow"
                  style={{ top: `-${i * 2}px`, left: `-${i * 1}px`, zIndex: i }}
                  aria-hidden
                />
              ))}
              <span
                key={cards.length}
                className="absolute inset-0 z-10 flex items-center justify-center text-xl font-bold text-white drop-shadow animate-in zoom-in-75 duration-300"
              >
                {cards.length}
              </span>
            </>
          )}
        </div>
      </div>
    );
  }

  function handleCardClick(cardId: string, handIndex: number) {
    if (!clickable) return;
    if (state.phase !== 'Main') return;
    if (state.priorityWindow) return;
    setSelected({ cardId, handIndex });
  }

  const selectedCard = selected ? state.catalog[selected.cardId] : null;
  const options: ActionMenuOption[] = [];
  if (selected && selectedCard) {
    const type: CardType = selectedCard.type;
    if (type === 'CHARACTER') {
      options.push({
        label: 'Play as Character',
        onClick: () =>
          dispatch({
            kind: 'PlayCharacter',
            player: playerIndex,
            handIndex: selected.handIndex,
            donSpent: 0,
          }),
      });
    } else if (type === 'EVENT') {
      options.push({
        label: 'Play as Event',
        onClick: () =>
          dispatch({
            kind: 'PlayEvent',
            player: playerIndex,
            handIndex: selected.handIndex,
            donSpent: 0,
          }),
      });
    } else if (type === 'STAGE') {
      options.push({
        label: 'Play as Stage',
        onClick: () =>
          dispatch({
            kind: 'PlayStage',
            player: playerIndex,
            handIndex: selected.handIndex,
            donSpent: 0,
          }),
      });
    }
  }

  return (
    <>
      <div className="flex items-center justify-center gap-2 overflow-x-auto p-3">
        {cards.length === 0 ? (
          <span className="text-xs italic opacity-50">empty hand</span>
        ) : (
          cards.map((cardId, i) => (
            <CardHoverPreview key={`${cardId}-${i}`} cardId={cardId}>
              <button
                type="button"
                className={`relative aspect-[5/7] w-24 shrink-0 overflow-hidden rounded border border-amber-900/60 transition animate-in fade-in-0 slide-in-from-right-16 duration-500 ease-out ${clickable ? 'cursor-pointer hover:ring-2 hover:ring-primary' : 'cursor-default'}`}
                onClick={() => handleCardClick(cardId, i)}
                disabled={!clickable}
                aria-label={`Card ${cardId}`}
              >
                <Image
                  src={cardImagePath(cardId)}
                  alt={cardId}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </button>
            </CardHoverPreview>
          ))
        )}
      </div>
      <ActionMenu
        title={selected ? `Play ${selected.cardId}` : ''}
        cardId={selected?.cardId}
        options={options}
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </>
  );
}
