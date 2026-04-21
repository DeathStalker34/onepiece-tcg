'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useGame } from './game-provider';

export function ActionBar() {
  const { state, dispatch } = useGame();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (state.phase === 'GameOver' || state.priorityWindow !== null) {
    return null;
  }

  function handlePass() {
    const res = dispatch({ kind: 'PassPhase', player: state.activePlayer });
    if (res.error) setErrorMsg(res.error.code);
    else setErrorMsg(null);
  }

  function handleEndTurn() {
    const res = dispatch({ kind: 'EndTurn', player: state.activePlayer });
    if (res.error) setErrorMsg(res.error.code);
    else setErrorMsg(null);
  }

  const showPass = state.phase === 'Refresh' || state.phase === 'Draw' || state.phase === 'Don';
  const showEndTurn = state.phase === 'Main';

  return (
    <div className="parchment-surface flex items-center gap-3 px-4 py-2 text-stone-900">
      <span className="text-sm font-semibold">
        {state.phase} phase · P{state.activePlayer}&apos;s turn
      </span>
      <div className="ml-auto flex items-center gap-2">
        {showPass && (
          <Button size="sm" onClick={handlePass}>
            Next phase
          </Button>
        )}
        {showEndTurn && (
          <Button size="sm" onClick={handleEndTurn}>
            End turn
          </Button>
        )}
      </div>
      {errorMsg && <span className="ml-2 text-xs text-red-700">{errorMsg}</span>}
    </div>
  );
}
