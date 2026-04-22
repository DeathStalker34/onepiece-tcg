import type { CardStatic, Effect } from './card';

export type PlayerIndex = 0 | 1;

export type Phase = 'Setup' | 'Refresh' | 'Draw' | 'Don' | 'Main' | 'End' | 'GameOver';

export interface AttackerRef {
  owner: PlayerIndex;
  source: { kind: 'Leader' } | { kind: 'Character'; instanceId: string };
  attackPower: number;
}

export interface DefenderRef {
  owner: PlayerIndex;
  target: { kind: 'Leader' } | { kind: 'Character'; instanceId: string };
  defensePower: number;
}

export type PriorityWindow =
  | { kind: 'Mulligan'; player: PlayerIndex }
  | { kind: 'CounterStep'; attacker: AttackerRef; defender: DefenderRef }
  | {
      kind: 'TriggerStep';
      revealedCardId: string;
      owner: PlayerIndex;
      triggerEffect: Effect;
    }
  | {
      kind: 'BlockerStep';
      attacker: AttackerRef;
      originalTarget: DefenderRef;
    };

export interface LeaderInPlay {
  cardId: string;
  rested: boolean;
  attachedDon: number;
  powerThisTurn: number;
}

export interface CharacterInPlay {
  instanceId: string;
  cardId: string;
  rested: boolean;
  attachedDon: number;
  powerThisTurn: number;
  summoningSickness: boolean;
  usedBlockerThisTurn: boolean;
}

export interface StageInPlay {
  cardId: string;
}

export interface PlayerState {
  playerId: string;
  leader: LeaderInPlay;
  deck: string[];
  hand: string[];
  life: string[];
  trash: string[];
  banishZone: string[];
  characters: CharacterInPlay[];
  stage: StageInPlay | null;
  donActive: number;
  donRested: number;
  donDeck: number;
  mulliganTaken: boolean;
  firstTurnUsed: boolean;
}

export interface PlayerSetup {
  playerId: string;
  leaderCardId: string;
  deck: string[];
}

export interface MatchSetup {
  seed: number;
  firstPlayer: PlayerIndex;
  players: [PlayerSetup, PlayerSetup];
  catalog: Record<string, CardStatic>;
}

export interface GameState {
  turn: number;
  activePlayer: PlayerIndex;
  phase: Phase;
  priorityWindow: PriorityWindow | null;
  players: [PlayerState, PlayerState];
  rng: { seed: number; pointer: number };
  log: Action[];
  winner: PlayerIndex | null;
  catalog: Record<string, CardStatic>;
  isFirstTurnOfFirstPlayer: boolean;
}

// Forward-declare Action here via import to avoid circular deps
import type { Action } from './action';
