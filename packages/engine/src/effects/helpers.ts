import type {
  Effect,
  EffectCondition,
  CardFilter,
  TargetSpec,
  TriggeredEffect,
} from '../types/card';

// Triggers
export function onPlay(effect: Effect): TriggeredEffect {
  return { trigger: 'OnPlay', effect };
}
export function onKo(effect: Effect): TriggeredEffect {
  return { trigger: 'OnKO', effect };
}
export function onAttack(effect: Effect): TriggeredEffect {
  return { trigger: 'OnAttack', effect };
}
export function activateMain(donCost: number, effect: Effect): TriggeredEffect {
  return { trigger: 'Activate:Main', cost: { donX: donCost }, effect };
}
export function endOfTurn(effect: Effect): TriggeredEffect {
  return { trigger: 'EndOfTurn', effect };
}
export function staticAura(condition: EffectCondition, effect: Effect): TriggeredEffect {
  return { trigger: 'StaticAura', condition, effect };
}
export function trigger(effect: Effect): TriggeredEffect {
  return { trigger: 'Trigger', effect };
}

// Conditions
export const onYourTurn: EffectCondition = { onTurn: 'yours' };
export const onOpponentsTurn: EffectCondition = { onTurn: 'opponents' };
export function donAtLeast(n: number): EffectCondition {
  return { attachedDonAtLeast: n };
}

// Targets
export function self(): TargetSpec {
  return { kind: 'self' };
}
export function opponentLeader(): TargetSpec {
  return { kind: 'opponentLeader' };
}
export function opponentChar(filter?: CardFilter): TargetSpec {
  return { kind: 'opponentCharacter', filter };
}
export function ownChar(filter?: CardFilter): TargetSpec {
  return { kind: 'ownCharacter', filter };
}

// Effect builders
export function drawN(n: number): Effect {
  return { kind: 'draw', amount: n };
}
export function ko(target: TargetSpec, opt = false): Effect {
  return { kind: 'ko', target, optional: opt };
}
export function powerDelta(
  target: TargetSpec,
  delta: number,
  duration: 'thisTurn' | 'permanent' = 'thisTurn',
  opt = false,
): Effect {
  return { kind: 'power', target, delta, duration, optional: opt };
}
export function returnToHand(target: TargetSpec, opt = false): Effect {
  return { kind: 'returnToHand', target, optional: opt };
}
export function banishEffect(target: TargetSpec, opt = false): Effect {
  return { kind: 'banish', target, optional: opt };
}
export function manual(text: string): Effect {
  return { kind: 'manual', text };
}
export function sequence(...steps: Effect[]): Effect {
  return { kind: 'sequence', steps };
}
export function searchEffect(from: 'deck' | 'trash', filter: CardFilter, amount: number): Effect {
  return { kind: 'search', from, filter, amount };
}

// Filter builders
export function powerLte(n: number): CardFilter {
  return { powerMax: n };
}
export function costLte(n: number): CardFilter {
  return { costMax: n };
}
export function color(c: string): CardFilter {
  return { colors: [c] };
}
