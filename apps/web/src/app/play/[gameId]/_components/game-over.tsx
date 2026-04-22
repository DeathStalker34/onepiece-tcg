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

export function GameOver() {
  const { state } = useGame();
  if (state.winner === null) return null;
  return (
    <Dialog open>
      <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Game over</DialogTitle>
          <DialogDescription>
            Winner: <strong>Player {state.winner}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button asChild>
            <Link href="/play">Play again</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/">Home</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
