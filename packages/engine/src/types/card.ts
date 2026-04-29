export const CARD_TYPES = ['LEADER', 'CHARACTER', 'EVENT', 'STAGE'] as const;
export type CardType = (typeof CARD_TYPES)[number];

export const KEYWORDS = ['Rush', 'Blocker', 'Counter', 'DoubleAttack', 'Banish'] as const;
export type Keyword = (typeof KEYWORDS)[number];

export interface CardFilter {
  type?: CardType;
  colors?: string[];
  costMax?: number;
  costMin?: number;
  powerMax?: number;
  powerMin?: number;
  keyword?: Keyword;
}

export type TargetSpec =
  | { kind: 'self' }
  | { kind: 'opponentLeader' }
  | { kind: 'opponentCharacter'; filter?: CardFilter }
  | { kind: 'ownCharacter'; filter?: CardFilter };

export interface EffectCost {
  rest?: 'self';
  donX?: number;
  trashHand?: number;
}

export interface EffectCondition {
  onTurn?: 'yours' | 'opponents';
  attachedDonAtLeast?: number;
}

export type Effect =
  | { kind: 'draw'; amount: number }
  | { kind: 'search'; from: 'deck' | 'trash'; filter: CardFilter; amount: number }
  | { kind: 'ko'; target: TargetSpec; optional?: boolean }
  | {
      kind: 'power';
      target: TargetSpec;
      delta: number;
      duration: 'thisTurn' | 'permanent';
      optional?: boolean;
    }
  | { kind: 'returnToHand'; target: TargetSpec; optional?: boolean }
  | { kind: 'banish'; target: TargetSpec; optional?: boolean }
  | { kind: 'sequence'; steps: Effect[] }
  | { kind: 'choice'; options: Effect[] }
  | { kind: 'manual'; text: string };

export interface TriggeredEffect {
  trigger:
    | 'OnPlay'
    | 'OnKO'
    | 'OnAttack'
    | 'Activate:Main'
    | 'EndOfTurn'
    | 'Trigger'
    | 'StaticAura';
  condition?: EffectCondition;
  cost?: EffectCost;
  effect: Effect;
}

export interface CardStatic {
  id: string;
  type: CardType;
  colors: string[];
  cost: number | null;
  power: number | null;
  life: number | null;
  counter: number | null;
  keywords: Keyword[];
  effects: TriggeredEffect[];
  manualText: string | null;
}
