'use client';

import { useGame } from './game-provider';

export function OpponentStatus() {
  const { state, botThinking, lastBotAction } = useGame();

  const phaseLabel =
    state.priorityWindow?.kind === 'Mulligan'
      ? 'Mulligan'
      : state.priorityWindow?.kind === 'CounterStep'
        ? 'Counter Step'
        : state.priorityWindow?.kind === 'BlockerStep'
          ? 'Blocker Step'
          : state.priorityWindow?.kind === 'TriggerStep'
            ? 'Trigger Step'
            : state.phase;

  return (
    <div className="zone-frame flex w-56 flex-col gap-1 p-3 text-sm">
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">Opponent</span>
        <span className="text-xs uppercase tracking-wide opacity-70">
          Turn {state.turn} · {phaseLabel}
        </span>
      </div>
      {botThinking ? (
        <span className="inline-flex items-center gap-2 text-amber-200">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" aria-hidden />
          Thinking…
        </span>
      ) : lastBotAction ? (
        <span className="text-xs opacity-80">Just: {lastBotAction.label}</span>
      ) : (
        <span className="text-xs italic opacity-50">Waiting…</span>
      )}
    </div>
  );
}
