'use client';

import { useState } from 'react';
import { useGame } from './game-provider';
import { PlayerSide } from './player-side';
import { TurnBanner } from './turn-banner';
import { ToastCenter } from './toast-center';
import { PriorityModal } from './priority-modal';
import { HotseatHandoff } from './hotseat-handoff';
import { GameOver } from './game-over';
import { GameLog } from './game-log';
import { Button } from '@/components/ui/button';
import { DisconnectBanner } from '@/app/play/online/[code]/_components/disconnect-banner';

export function Board() {
  const { state, dispatch, botPlayers, isOnline, myPlayerIndex, forfeit } = useGame();
  const [logOpen, setLogOpen] = useState(false);

  const canEndTurn =
    state.phase === 'Main' &&
    state.priorityWindow === null &&
    !botPlayers[state.activePlayer] &&
    (!isOnline || myPlayerIndex === state.activePlayer);

  // In online mode, render the local player at the bottom (non-mirror).
  const bottomIdx = isOnline && myPlayerIndex !== null ? myPlayerIndex : 0;
  const topIdx = bottomIdx === 0 ? 1 : 0;

  async function handleForfeit(): Promise<void> {
    if (!forfeit) return;
    if (window.confirm('Forfeit the match?')) await forfeit();
  }

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
        {isOnline && state.phase !== 'GameOver' && (
          <Button size="sm" variant="destructive" onClick={handleForfeit}>
            Forfeit
          </Button>
        )}
      </div>
      {isOnline && <DisconnectBanner />}

      <div className="space-y-4 p-4 xl:p-6">
        <PlayerSide playerIndex={topIdx} mirror />
        <hr className="border-amber-800/40" />
        <PlayerSide playerIndex={bottomIdx} />
      </div>

      <GameLog open={logOpen} onClose={() => setLogOpen(false)} />
      <PriorityModal />
      <HotseatHandoff />
      <ToastCenter />
      <GameOver />
    </div>
  );
}
