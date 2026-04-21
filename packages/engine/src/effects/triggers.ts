import type { GameState, PlayerIndex } from '../types/state';
import type { GameEvent } from '../types/event';
import type { TriggeredEffect } from '../types/card';
import { applyEffect, type EffectContext } from './executor';

export interface TriggerResult {
  state: GameState;
  events: GameEvent[];
}

/**
 * Fires all TriggeredEffects on a card matching `hook`. Returns updated state + events.
 */
export function triggerHook(
  state: GameState,
  hook: TriggeredEffect['trigger'],
  sourceCardId: string,
  sourcePlayer: PlayerIndex,
): TriggerResult {
  const card = state.catalog[sourceCardId];
  if (!card) return { state, events: [] };
  const events: GameEvent[] = [];
  let next = state;
  for (const te of card.effects) {
    if (te.trigger !== hook) continue;
    const context: EffectContext = { sourcePlayer, sourceCardId };
    const r = applyEffect(next, te.effect, context);
    next = r.state;
    events.push(...r.events);
  }
  return { state: next, events };
}
