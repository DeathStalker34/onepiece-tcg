import type { GameState, PlayerIndex } from '../types/state';
import type { GameEvent } from '../types/event';

export function runDraw(state: GameState): { state: GameState; events: GameEvent[] } {
  if (state.isFirstTurnOfFirstPlayer) {
    return {
      state: { ...state, phase: 'Draw' },
      events: [{ kind: 'PhaseEntered', phase: 'Draw' }],
    };
  }
  const p = state.players[state.activePlayer];
  if (p.deck.length === 0) {
    const otherPlayer: PlayerIndex = state.activePlayer === 0 ? 1 : 0;
    return {
      state: { ...state, winner: otherPlayer, phase: 'GameOver' },
      events: [
        { kind: 'PhaseEntered', phase: 'Draw' },
        { kind: 'GameOver', winner: otherPlayer },
      ],
    };
  }
  const [top, ...rest] = p.deck;
  const updatedPlayer = { ...p, deck: rest, hand: [...p.hand, top] };
  const nextPlayers = state.players.map((pp, i) =>
    i === state.activePlayer ? updatedPlayer : pp,
  ) as GameState['players'];
  return {
    state: { ...state, players: nextPlayers, phase: 'Draw' },
    events: [
      { kind: 'PhaseEntered', phase: 'Draw' },
      { kind: 'CardDrawn', player: state.activePlayer, count: 1 },
    ],
  };
}
