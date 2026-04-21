'use client';

import { ActionBar } from './action-bar';
import { PlayerSide } from './player-side';
import { PriorityModal } from './priority-modal';

export function Board() {
  return (
    <div className="tabletop-bg flex flex-col gap-4 p-6">
      <ActionBar />
      <PlayerSide playerIndex={1} />
      <hr className="border-amber-800/40" />
      <PlayerSide playerIndex={0} />
      <PriorityModal />
    </div>
  );
}
