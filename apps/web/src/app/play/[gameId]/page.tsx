'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { MatchSetup } from '@optcg/engine';
import { Button } from '@/components/ui/button';
import { GameProvider } from './_components/game-provider';
import { Board } from './_components/board';

type AiOpponent = 'easy' | 'medium' | null;

interface StoredGame {
  setup: MatchSetup;
  aiOpponent: AiOpponent;
}

function isStoredGame(value: unknown): value is StoredGame {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return 'setup' in v && 'aiOpponent' in v;
}

function isMatchSetup(value: unknown): value is MatchSetup {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return 'players' in v && 'catalog' in v;
}

export default function GamePage({ params }: { params: { gameId: string } }) {
  const [setup, setSetup] = useState<MatchSetup | null>(null);
  const [aiOpponent, setAiOpponent] = useState<AiOpponent>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`optcg.game.${params.gameId}`);
      if (!raw) {
        setError('Game setup not found. Start a new match.');
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      // Back-compat: old format stored setup directly
      if (isStoredGame(parsed)) {
        setSetup(parsed.setup);
        setAiOpponent(parsed.aiOpponent);
      } else if (isMatchSetup(parsed)) {
        setSetup(parsed);
        setAiOpponent(null);
      } else {
        setError('Unrecognized game setup format.');
      }
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
    <GameProvider setup={setup} aiOpponent={aiOpponent}>
      <Board />
    </GameProvider>
  );
}
