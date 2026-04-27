import type { GameState, PlayerIndex } from '../types/state';
import type { GameEvent } from '../types/event';
import type { TriggeredEffect } from '../types/card';
import { applyEffect, type EffectContext } from './executor';

export interface TriggerResult {
  state: GameState;
  events: GameEvent[];
}

/**
 * Fires all TriggeredEffects on a card matching `hook`, in order.
 * If one effect opens a priority window (e.g. EffectTargetSelection),
 * the remaining same-trigger effects are queued in `pendingChain`
 * for resumption after the window resolves.
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
  const context: EffectContext = { sourcePlayer, sourceCardId };

  const queue = card.effects.filter((te) => te.trigger === hook).map((te) => te.effect);
  while (queue.length > 0) {
    const effect = queue.shift()!;
    const r = applyEffect(next, effect, context);
    next = r.state;
    events.push(...r.events);
    if (next.priorityWindow?.kind === 'EffectTargetSelection') {
      next = {
        ...next,
        priorityWindow: { ...next.priorityWindow, pendingChain: queue.slice() },
      };
      break;
    }
  }
  return { state: next, events };
}
