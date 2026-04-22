'use client';

import { useState } from 'react';
import { useGame } from './game-provider';
import { PlayerSide } from './player-side';
import { ActionBar } from './action-bar';
import { TurnBanner } from './turn-banner';
import { PriorityModal } from './priority-modal';
import { HotseatHandoff } from './hotseat-handoff';
import { GameOver } from './game-over';
import { GameLog } from './game-log';
import { Button } from '@/components/ui/button';

export function Board() {
  useGame();
  const [logOpen, setLogOpen] = useState(false);

  return (
    <div className="tabletop-bg min-h-screen">
      <ActionBar />
      <TurnBanner />

      {/* Floating "Log" toggle in top-right corner */}
      <div className="fixed right-4 top-16 z-20">
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
