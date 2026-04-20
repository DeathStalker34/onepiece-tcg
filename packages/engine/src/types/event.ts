import type { PlayerIndex, Phase } from './state';
import type { Effect } from './card';

export type GameEvent =
  | { kind: 'PhaseEntered'; phase: Phase }
  | { kind: 'CardDrawn'; player: PlayerIndex; count: number }
  | { kind: 'CardPlayed'; player: PlayerIndex; cardId: string; donSpent: number }
  | { kind: 'DonAttached'; player: PlayerIndex; target: string; amount: number }
  | { kind: 'AttackDeclared'; attacker: string; target: string; power: number }
  | { kind: 'CounterPlayed'; player: PlayerIndex; cardId: string; counterAmount: number }
  | { kind: 'BlockerUsed'; blockerInstanceId: string }
  | { kind: 'CharacterKod'; instanceId: string; cardId: string }
  | {
      kind: 'LifeLost';
      player: PlayerIndex;
      remaining: number;
      revealedCardId: string;
    }
  | { kind: 'TriggerResolved'; cardId: string; activated: boolean }
  | { kind: 'EffectResolved'; effect: Effect; sourceCardId: string }
  | { kind: 'GameOver'; winner: PlayerIndex };
