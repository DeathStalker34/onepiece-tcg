import type { GameState } from '../types/state';
import type { GameEvent } from '../types/event';

export function runDon(state: GameState): { state: GameState; events: GameEvent[] } {
  const p = state.players[state.activePlayer];
  const toAdd = state.isFirstTurnOfFirstPlayer ? 1 : 2;
  const actualAdd = Math.min(toAdd, p.donDeck);
  const updatedPlayer = {
    ...p,
    donActive: p.donActive + actualAdd,
    donDeck: p.donDeck - actualAdd,
  };
  const nextPlayers = state.players.map((pp, i) =>
    i === state.activePlayer ? updatedPlayer : pp,
  ) as GameState['players'];
  return {
    state: { ...state, players: nextPlayers, phase: 'Don' },
    events: [{ kind: 'PhaseEntered', phase: 'Don' }],
  };
}
