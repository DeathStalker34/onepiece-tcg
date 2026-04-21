import type { GameState } from '../types/state';
import type { Action } from '../types/action';
import type { GameEvent } from '../types/event';
import type { EngineError } from '../types/error';
import { applyEffect, type EffectContext } from '../effects/executor';

export interface TriggerResult {
  state: GameState;
  events: GameEvent[];
  error?: EngineError;
}

export function activateTrigger(
  state: GameState,
  action: Extract<Action, { kind: 'ActivateTrigger' }>,
): TriggerResult {
  if (state.priorityWindow?.kind !== 'TriggerStep') {
    return { state, events: [], error: { code: 'NotYourPriority' } };
  }
  if (state.priorityWindow.owner !== action.player) {
    return { state, events: [], error: { code: 'NotYourPriority' } };
  }

  const owner = state.priorityWindow.owner;
  const revealed = state.priorityWindow.revealedCardId;
  const effect = state.priorityWindow.triggerEffect;
  const p = state.players[owner];

  // Revealed card moves to hand regardless of activation
  const updatedPlayer = { ...p, hand: [...p.hand, revealed] };
  const newPlayers = state.players.map((pp, i) =>
    i === owner ? updatedPlayer : pp,
  ) as GameState['players'];
  const events: GameEvent[] = [
    { kind: 'TriggerResolved', cardId: revealed, activated: action.activate },
  ];

  if (action.activate) {
    const context: EffectContext = { sourcePlayer: owner, sourceCardId: revealed };
    const r = applyEffect({ ...state, players: newPlayers, priorityWindow: null }, effect, context);
    return {
      state: r.state,
      events: [...events, ...r.events],
    };
  }

  return {
    state: { ...state, players: newPlayers, priorityWindow: null },
    events,
  };
}
