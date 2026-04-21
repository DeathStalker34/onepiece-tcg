import type { GameState } from '../types/state';
import type { Action } from '../types/action';
import type { GameEvent } from '../types/event';
import type { EngineError } from '../types/error';

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

  let updatedPlayer = { ...p, hand: [...p.hand, revealed] };
  const events: GameEvent[] = [
    { kind: 'TriggerResolved', cardId: revealed, activated: action.activate },
  ];

  if (action.activate) {
    // Execute the trigger effect — Task 13 will centralize; for now handle `draw`
    if (effect.kind === 'draw') {
      const toDraw = Math.min(effect.amount, updatedPlayer.deck.length);
      if (toDraw > 0) {
        const drawn = updatedPlayer.deck.slice(0, toDraw);
        updatedPlayer = {
          ...updatedPlayer,
          hand: [...updatedPlayer.hand, ...drawn],
          deck: updatedPlayer.deck.slice(toDraw),
        };
        events.push({ kind: 'CardDrawn', player: owner, count: toDraw });
      }
    }
    // Other effect kinds ignored here — Task 13 handles them.
    events.push({ kind: 'EffectResolved', effect, sourceCardId: revealed });
  }

  const newPlayers = state.players.map((pp, i) =>
    i === owner ? updatedPlayer : pp,
  ) as GameState['players'];

  return {
    state: { ...state, players: newPlayers, priorityWindow: null },
    events,
  };
}
