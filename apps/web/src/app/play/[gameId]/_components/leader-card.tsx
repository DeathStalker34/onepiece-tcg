'use client';

import Image from 'next/image';
import { cardImagePath } from '@/lib/card-image';
import type { LeaderInPlay } from '@optcg/engine';

interface Props {
  leader: LeaderInPlay;
  lifeCount: number;
  onActivateMain?: () => void;
  canActivate?: boolean;
}

export function LeaderCard({ leader, lifeCount, onActivateMain, canActivate = false }: Props) {
  const inner = (
    <>
      <Image
        src={cardImagePath(leader.cardId)}
        alt={leader.cardId}
        fill
        sizes="80px"
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
    </>
  );

  const baseClass = `relative aspect-[5/7] w-20 overflow-hidden rounded border-2 border-amber-900/70 transition-transform duration-200 ${leader.rested ? 'rotate-90' : ''}`;

  return (
    <div className="flex items-center gap-2">
      {canActivate && onActivateMain ? (
        <button
          type="button"
          className={`${baseClass} transition hover:ring-2 hover:ring-primary`}
          onClick={onActivateMain}
          aria-label="Activate leader main ability"
        >
          {inner}
        </button>
      ) : (
        <div className={baseClass}>{inner}</div>
      )}
      <div className="text-center">
        <div className="zone-label">Life</div>
        <div className="text-2xl font-bold leading-none">{lifeCount}</div>
      </div>
    </div>
  );
}
