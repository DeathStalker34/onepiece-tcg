'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useGame } from './game-provider';

export function ActionBar() {
  const { state, dispatch, botPlayers } = useGame();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (state.phase === 'GameOver' || state.priorityWindow !== null) {
    return null;
  }

  function handleEndTurn() {
    const res = dispatch({ kind: 'EndTurn', player: state.activePlayer });
    if (res.error) setErrorMsg(res.error.code);
    else setErrorMsg(null);
  }

  const showEndTurn = state.phase === 'Main';
  const isPvAI = Boolean(botPlayers[0] || botPlayers[1]);
  const isBot = Boolean(botPlayers[state.activePlayer]);
  const turnLabel = isPvAI
    ? isBot
      ? "Opponent's turn"
      : 'Your turn'
    : `Player ${state.activePlayer}'s turn`;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 text-sm font-semibold shadow-md ${
        isBot ? 'bg-stone-800 text-amber-200' : 'bg-amber-100 text-stone-900'
      }`}
    >
      <span className="text-base font-bold">{turnLabel}</span>
      <span className="opacity-70">· {state.phase} phase</span>
      <div className="ml-auto flex items-center gap-2">
        {showEndTurn && !isBot && (
          <Button size="sm" onClick={handleEndTurn}>
            End turn
          </Button>
        )}
        {isBot && <span className="text-xs italic opacity-70">AI is thinking…</span>}
      </div>
      {errorMsg && <span className="ml-2 text-xs text-red-700">{errorMsg}</span>}
    </div>
  );
}
