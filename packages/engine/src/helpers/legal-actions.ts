import type { Action } from '../types/action';
import type { GameState } from '../types/state';

export function computeLegalActions(state: GameState): Action[] {
  if (state.winner !== null || state.phase === 'GameOver') return [];

  if (state.priorityWindow?.kind === 'Mulligan') {
    const p = state.priorityWindow.player;
    return [
      { kind: 'Mulligan', player: p, mulligan: true },
      { kind: 'Mulligan', player: p, mulligan: false },
    ];
  }

  if (state.priorityWindow?.kind === 'EffectTargetSelection') {
    const pw = state.priorityWindow;
    const actions: Action[] = [];
    for (let i = 0; i < pw.validTargets.length; i += 1) {
      actions.push({ kind: 'SelectEffectTarget', player: pw.sourceOwner, targetIndex: i });
    }
    if (pw.optional) {
      actions.push({ kind: 'SelectEffectTarget', player: pw.sourceOwner, targetIndex: null });
    }
    return actions;
  }

  // Other priority windows (Counter/Trigger/Blocker) are filled by later tasks.
  if (state.priorityWindow !== null) return [];

  const actions: Action[] = [];
  const ap = state.activePlayer;

  if (state.phase === 'Refresh' || state.phase === 'Draw' || state.phase === 'Don') {
    actions.push({ kind: 'PassPhase', player: ap });
  }
  if (state.phase === 'Main') {
    actions.push({ kind: 'EndTurn', player: ap });
    // Play/Attack/Attach/Activate legal actions are added in Tasks 8-12.
  }
  return actions;
}
