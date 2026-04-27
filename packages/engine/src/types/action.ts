import type { PlayerIndex } from './state';

export type Action =
  | { kind: 'Mulligan'; player: PlayerIndex; mulligan: boolean }
  | { kind: 'PassPhase'; player: PlayerIndex }
  | { kind: 'EndTurn'; player: PlayerIndex }
  | { kind: 'PlayCharacter'; player: PlayerIndex; handIndex: number; donSpent: number }
  | { kind: 'PlayEvent'; player: PlayerIndex; handIndex: number; donSpent: number }
  | { kind: 'PlayStage'; player: PlayerIndex; handIndex: number; donSpent: number }
  | {
      kind: 'AttachDon';
      player: PlayerIndex;
      target: { kind: 'Leader' } | { kind: 'Character'; instanceId: string };
    }
  | {
      kind: 'ActivateMain';
      player: PlayerIndex;
      source: { kind: 'Leader' } | { kind: 'Character'; instanceId: string };
    }
  | {
      kind: 'DeclareAttack';
      player: PlayerIndex;
      attacker: { kind: 'Leader' } | { kind: 'Character'; instanceId: string };
      target: { kind: 'Leader' } | { kind: 'Character'; instanceId: string; owner: PlayerIndex };
    }
  | { kind: 'PlayCounter'; player: PlayerIndex; handIndex: number }
  | { kind: 'DeclineCounter'; player: PlayerIndex }
  | { kind: 'UseBlocker'; player: PlayerIndex; blockerInstanceId: string }
  | { kind: 'DeclineBlocker'; player: PlayerIndex }
  | { kind: 'ActivateTrigger'; player: PlayerIndex; activate: boolean }
  | { kind: 'SelectEffectTarget'; player: PlayerIndex; targetIndex: number | null };
