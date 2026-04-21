'use client';

import { useGame } from './game-provider';
import { PlayerSide } from './player-side';
import { ActionBar } from './action-bar';
import { PriorityModal } from './priority-modal';
import { HotseatHandoff } from './hotseat-handoff';
import { GameOver } from './game-over';
import { GameLog } from './game-log';

export function Board() {
  useGame(); // subscribe

  return (
    <div className="tabletop-bg min-h-screen">
      <ActionBar />
      <div className="flex gap-4 p-6">
        <div className="flex-1 space-y-4">
          <PlayerSide playerIndex={1} />
          <hr className="border-amber-800/40" />
          <PlayerSide playerIndex={0} />
        </div>
        <GameLog />
      </div>
      <PriorityModal />
      <HotseatHandoff />
      <GameOver />
    </div>
  );
}
