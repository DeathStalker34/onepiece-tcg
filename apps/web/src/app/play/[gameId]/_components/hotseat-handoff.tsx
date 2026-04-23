'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useGame } from './game-provider';

export function HotseatHandoff() {
  const { state, botPlayers, isOnline } = useGame();
  const prevActive = useRef(state.activePlayer);
  const prevTurn = useRef(state.turn);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state.phase === 'GameOver') return;
    // In PvAI mode (any bot configured) or online mode, no device to pass.
    if (botPlayers[0] || botPlayers[1] || isOnline) return;
    if (state.activePlayer !== prevActive.current && state.turn !== prevTurn.current) {
      setOpen(true);
    }
    prevActive.current = state.activePlayer;
    prevTurn.current = state.turn;
  }, [state.activePlayer, state.turn, state.phase, botPlayers, isOnline]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Pass the device</DialogTitle>
          <DialogDescription>
            It is now Player {state.activePlayer}&apos;s turn. Hand over the device and click below
            to continue.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button onClick={() => setOpen(false)}>Ready</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
