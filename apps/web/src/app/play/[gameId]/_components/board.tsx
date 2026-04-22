'use client';

import { useState } from 'react';
import { useGame } from './game-provider';
import { PlayerSide } from './player-side';
import { TurnBanner } from './turn-banner';
import { PriorityModal } from './priority-modal';
import { HotseatHandoff } from './hotseat-handoff';
import { GameOver } from './game-over';
import { GameLog } from './game-log';
import { Button } from '@/components/ui/button';

export function Board() {
  const { state, dispatch, botPlayers } = useGame();
  const [logOpen, setLogOpen] = useState(false);

  const canEndTurn =
    state.phase === 'Main' && state.priorityWindow === null && !botPlayers[state.activePlayer];

  return (
    <div className="tabletop-bg min-h-screen">
      <TurnBanner />

      {/* Floating controls top-right */}
      <div className="fixed right-4 top-4 z-20 flex items-center gap-2">
        {canEndTurn && (
          <Button onClick={() => dispatch({ kind: 'EndTurn', player: state.activePlayer })}>
            End turn
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => setLogOpen(true)}>
          Log
        </Button>
      </div>

      <div className="space-y-4 p-4 xl:p-6">
        <PlayerSide playerIndex={1} mirror />
        <hr className="border-amber-800/40" />
        <PlayerSide playerIndex={0} />
      </div>

      <GameLog open={logOpen} onClose={() => setLogOpen(false)} />
      <PriorityModal />
      <HotseatHandoff />
      <GameOver />
    </div>
  );
}
