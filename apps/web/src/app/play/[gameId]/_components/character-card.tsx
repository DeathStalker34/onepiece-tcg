'use client';

import Image from 'next/image';
import { cardImagePath } from '@/lib/card-image';
import type { CharacterInPlay } from '@optcg/engine';

interface Props {
  char: CharacterInPlay;
  onActivateMain?: () => void;
  canActivate?: boolean;
}

export function CharacterCard({ char, onActivateMain, canActivate = false }: Props) {
  const inner = (
    <>
      <Image
        src={cardImagePath(char.cardId)}
        alt={char.cardId}
        fill
        sizes="64px"
        className="object-cover"
      />
      {char.attachedDon > 0 && (
        <span className="absolute right-0.5 top-0.5 rounded bg-yellow-600 px-1 text-[9px] font-bold text-white">
          +{char.attachedDon}
        </span>
      )}
    </>
  );

  const baseClass = `relative aspect-[5/7] w-16 overflow-hidden rounded border border-amber-900/70 transition-transform duration-200 ${char.rested ? 'rotate-90' : ''} ${char.summoningSickness ? 'opacity-60' : ''}`;
  const title = `${char.cardId}${char.summoningSickness ? ' (summoning sickness)' : ''}`;

  if (canActivate && onActivateMain) {
    return (
      <button
        type="button"
        className={`${baseClass} transition hover:ring-2 hover:ring-primary`}
        onClick={onActivateMain}
        title={title}
        aria-label={`Activate ${char.cardId} main ability`}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={baseClass} title={title}>
      {inner}
    </div>
  );
}
