import { HIDDEN_CARD_ID } from '@optcg/protocol';
import type { GameState, PlayerIndex, PlayerState } from '@optcg/engine';

function hideArray<T>(arr: T[]): string[] {
  return new Array<string>(arr.length).fill(HIDDEN_CARD_ID);
}

function hidePlayer(p: PlayerState): PlayerState {
  return {
    ...p,
    hand: hideArray(p.hand),
    life: hideArray(p.life),
    deck: hideArray(p.deck),
  };
}

export function filterStateForPlayer(state: GameState, receiver: PlayerIndex): GameState {
  const opponentIndex: PlayerIndex = receiver === 0 ? 1 : 0;
  const newPlayers: GameState['players'] = [state.players[0], state.players[1]];
  newPlayers[opponentIndex] = hidePlayer(state.players[opponentIndex]);
  return { ...state, players: newPlayers };
}
