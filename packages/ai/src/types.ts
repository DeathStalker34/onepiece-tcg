import type { Action, GameState, PlayerIndex, RngState } from '@optcg/engine';

export interface BotDecision {
  action: Action;
  rng: RngState;
  rationale?: string;
}

export interface Bot {
  id: 'easy' | 'medium';
  name: string;
  pick(state: GameState, player: PlayerIndex, rng: RngState): BotDecision;
}
