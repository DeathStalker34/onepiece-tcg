'use client';

import { useEffect, useRef, useState } from 'react';
import { useGame } from './game-provider';

export function TurnBanner() {
  const { state, botPlayers } = useGame();
  const prevActive = useRef<number | null>(null);
  const prevTurn = useRef<number>(state.turn);
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (state.phase === 'GameOver') return;
    if (state.priorityWindow !== null) return;

    const activeChanged = prevActive.current !== state.activePlayer;
    const turnChanged = prevTurn.current !== state.turn;
    prevActive.current = state.activePlayer;
    prevTurn.current = state.turn;

    if (!activeChanged && !turnChanged) return;
    if (state.turn === 0) return; // still in setup

    const isBot = Boolean(botPlayers[state.activePlayer]);
    const isPvAI = Boolean(botPlayers[0] || botPlayers[1]);
    let text: string;
    if (isPvAI) {
      text = isBot ? "Opponent's turn" : 'Your turn';
    } else {
      text = `Player ${state.activePlayer}'s turn`;
    }
    setMessage(text);
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 2000);
    return () => clearTimeout(timer);
  }, [state.activePlayer, state.turn, state.phase, state.priorityWindow, botPlayers]);

  if (!message) return null;

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
      aria-live="polite"
    >
      <div className="rounded-full border-2 border-amber-600 bg-stone-900/95 px-8 py-3 text-2xl font-bold text-amber-100 shadow-2xl">
        {message}
      </div>
    </div>
  );
}
