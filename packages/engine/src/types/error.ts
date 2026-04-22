import type { Phase } from './state';

export type EngineError =
  | { code: 'WrongPhase'; expected: Phase[]; actual: Phase }
  | { code: 'NotYourPriority' }
  | { code: 'NotEnoughDon'; need: number; have: number }
  | { code: 'InvalidTarget'; reason: string }
  | { code: 'CardNotInHand' }
  | { code: 'ColorMismatch' }
  | { code: 'MaxCharactersReached'; limit: 5 }
  | { code: 'CharacterAlreadyAttacked' }
  | { code: 'CharacterIsRested' }
  | { code: 'SummoningSickness' }
  | { code: 'CannotAttackFirstTurn' }
  | { code: 'GameAlreadyOver' }
  | { code: 'Unknown'; detail: string };
