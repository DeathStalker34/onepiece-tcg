'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { MatchSetup } from '@optcg/engine';
import { Button } from '@/components/ui/button';
import { GameProvider } from './_components/game-provider';

export default function GamePage({ params }: { params: { gameId: string } }) {
  const [setup, setSetup] = useState<MatchSetup | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`optcg.game.${params.gameId}`);
      if (!raw) {
        setError('Game setup not found. Start a new match.');
        return;
      }
      const parsed = JSON.parse(raw) as MatchSetup;
      setSetup(parsed);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [params.gameId]);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="mb-4 text-red-500">{error}</p>
        <Button asChild>
          <Link href="/play">Back to setup</Link>
        </Button>
      </main>
    );
  }

  if (!setup) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-muted-foreground">Loading match…</p>
      </main>
    );
  }

  return (
    <GameProvider setup={setup}>
      <BoardPlaceholder gameId={params.gameId} />
    </GameProvider>
  );
}

function BoardPlaceholder({ gameId }: { gameId: string }) {
  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Game {gameId}</h1>
      <p className="text-muted-foreground">Board renders here (Task 5).</p>
      <Button asChild variant="secondary" className="mt-4">
        <Link href="/play">Back to setup</Link>
      </Button>
    </main>
  );
}
