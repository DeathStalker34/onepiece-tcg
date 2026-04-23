'use client';

import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useGame } from './game-provider';

const REASON_LABEL: Record<string, string> = {
  engine: 'decided on the board',
  forfeit: 'opponent forfeited',
  timeout: "opponent didn't return in time",
};

export function GameOver() {
  const { state, isOnline, rematch, lastGameOverReason } = useGame();
  if (state.winner === null) return null;
  const reason = lastGameOverReason ? REASON_LABEL[lastGameOverReason] : null;
  return (
    <Dialog open>
      <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Game over</DialogTitle>
          <DialogDescription>
            Winner: <strong>Player {state.winner}</strong>
            {reason && <span className="block text-sm opacity-70">({reason})</span>}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          {isOnline && rematch ? (
            <>
              <Button onClick={() => void rematch(true)}>Rematch</Button>
              <Button asChild variant="secondary">
                <Link href="/play/online">Leave</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild>
                <Link href="/play">Play again</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/">Home</Link>
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
