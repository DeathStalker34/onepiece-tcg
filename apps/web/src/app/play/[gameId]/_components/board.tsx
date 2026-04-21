'use client';

import { useGame } from './game-provider';
import { PlayerSide } from './player-side';

export function Board() {
  const { state } = useGame();

  return (
    <div className="tabletop-bg flex flex-col gap-4 p-6">
      <PhaseBanner />
      <PlayerSide playerIndex={1} />
      <hr className="border-amber-800/40" />
      <PlayerSide playerIndex={0} />
    </div>
  );

  function PhaseBanner() {
    const pw = state.priorityWindow;
    const label = pw
      ? `Priority: ${pw.kind}${'player' in pw ? ` (P${pw.player})` : ''}`
      : `${state.phase} phase — P${state.activePlayer}'s turn`;
    return (
      <div className="parchment-surface px-4 py-2 text-center text-sm font-semibold text-stone-900">
        {label}
      </div>
    );
  }
}
