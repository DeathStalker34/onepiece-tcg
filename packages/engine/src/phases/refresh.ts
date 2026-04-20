import type { GameState } from '../types/state';
import type { GameEvent } from '../types/event';

export function runRefresh(state: GameState): { state: GameState; events: GameEvent[] } {
  const p = state.players[state.activePlayer];
  const refreshedLeader = { ...p.leader, rested: false };
  const refreshedChars = p.characters.map((c) => ({
    ...c,
    rested: false,
    usedBlockerThisTurn: false,
  }));
  const totalDon = p.donActive + p.donRested;
  const updatedPlayer = {
    ...p,
    leader: refreshedLeader,
    characters: refreshedChars,
    donActive: totalDon,
    donRested: 0,
  };
  const nextPlayers = state.players.map((pp, i) =>
    i === state.activePlayer ? updatedPlayer : pp,
  ) as GameState['players'];
  return {
    state: { ...state, players: nextPlayers, phase: 'Refresh' },
    events: [{ kind: 'PhaseEntered', phase: 'Refresh' }],
  };
}
