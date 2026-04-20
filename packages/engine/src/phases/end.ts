import type { GameState } from '../types/state';
import type { GameEvent } from '../types/event';

export function runEnd(state: GameState): { state: GameState; events: GameEvent[] } {
  const p = state.players[state.activePlayer];
  // Return attached DON to the active pool and reset per-turn flags.
  const totalAttachedDon =
    p.leader.attachedDon + p.characters.reduce((sum, c) => sum + c.attachedDon, 0);
  const resetLeader = { ...p.leader, attachedDon: 0, powerThisTurn: 0 };
  const resetChars = p.characters.map((c) => ({
    ...c,
    attachedDon: 0,
    powerThisTurn: 0,
    summoningSickness: false,
    usedBlockerThisTurn: false,
  }));
  let updatedPlayer = {
    ...p,
    leader: resetLeader,
    characters: resetChars,
    donActive: p.donActive + totalAttachedDon,
  };
  // Hand limit: max 10. Discard the excess from the end of the hand.
  if (updatedPlayer.hand.length > 10) {
    const excess = updatedPlayer.hand.length - 10;
    const kept = updatedPlayer.hand.slice(0, updatedPlayer.hand.length - excess);
    const discarded = updatedPlayer.hand.slice(updatedPlayer.hand.length - excess);
    updatedPlayer = {
      ...updatedPlayer,
      hand: kept,
      trash: [...updatedPlayer.trash, ...discarded],
    };
  }
  const nextPlayers = state.players.map((pp, i) =>
    i === state.activePlayer ? updatedPlayer : pp,
  ) as GameState['players'];
  return {
    state: { ...state, players: nextPlayers, phase: 'End' },
    events: [{ kind: 'PhaseEntered', phase: 'End' }],
  };
}
