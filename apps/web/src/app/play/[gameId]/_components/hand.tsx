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
  label,
  clickable = false,
  playerIndex,
}: {
  cards: string[];
  hidden?: boolean;
  label: string;
  clickable?: boolean;
  playerIndex: 0 | 1;
}) {
  const { state, dispatch } = useGame();
  const [selected, setSelected] = useState<{ cardId: string; handIndex: number } | null>(null);

  if (hidden) {
    return (
      <div className="zone-frame flex items-center gap-3 p-3">
        <div className="zone-label">{label}</div>
        <div className="flex items-center gap-1">
          {cards.slice(0, Math.min(cards.length, 10)).map((_, i) => (
            <div
              key={i}
              className="aspect-[5/7] w-24 rounded border border-amber-900/60 bg-stone-800 animate-in fade-in-0 duration-200"
              aria-hidden
            />
          ))}
        </div>
        <span className="text-xs opacity-70">{cards.length} cards</span>
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
      <div className="zone-frame flex items-center gap-2 overflow-x-auto p-3">
        <div className="zone-label shrink-0">{label}</div>
        {cards.length === 0 ? (
          <span className="text-xs italic opacity-50">empty</span>
        ) : (
          cards.map((cardId, i) => (
            <CardHoverPreview key={`${cardId}-${i}`} cardId={cardId}>
              <button
                type="button"
                className={`relative aspect-[5/7] w-24 shrink-0 overflow-hidden rounded border border-amber-900/60 animate-in fade-in-0 slide-in-from-right-16 duration-500 ease-out ${clickable ? 'cursor-pointer transition-transform hover:scale-105 hover:ring-2 hover:ring-primary' : 'cursor-default'}`}
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
