import type { GameState } from '../types/state';
import type { Action } from '../types/action';
import type { GameEvent } from '../types/event';
import type { EngineError } from '../types/error';
import { resolveCombat } from './resolve';
import { availableBlockers } from './blocker';

export interface CounterResult {
  state: GameState;
  events: GameEvent[];
  error?: EngineError;
}

export function playCounter(
  state: GameState,
  action: Extract<Action, { kind: 'PlayCounter' }>,
): CounterResult {
  if (state.priorityWindow?.kind !== 'CounterStep') {
    return { state, events: [], error: { code: 'NotYourPriority' } };
  }
  const defenderOwner = state.priorityWindow.defender.owner;
  if (action.player !== defenderOwner) {
    return { state, events: [], error: { code: 'NotYourPriority' } };
  }
  const p = state.players[defenderOwner];
  const cardId = p.hand[action.handIndex];
  if (!cardId) return { state, events: [], error: { code: 'CardNotInHand' } };
  const card = state.catalog[cardId];
  if (!card)
    return { state, events: [], error: { code: 'Unknown', detail: 'counter card not in catalog' } };
  if (card.counter === null || card.counter <= 0) {
    return {
      state,
      events: [],
      error: { code: 'InvalidTarget', reason: 'card has no counter value' },
    };
  }

  const counterAmount = card.counter;
  const newHand = [...p.hand.slice(0, action.handIndex), ...p.hand.slice(action.handIndex + 1)];
  const updatedPlayer = {
    ...p,
    hand: newHand,
    trash: [...p.trash, cardId],
  };
  const newPlayers = state.players.map((pp, i) =>
    i === defenderOwner ? updatedPlayer : pp,
  ) as GameState['players'];

  const updatedWindow: GameState['priorityWindow'] = {
    kind: 'CounterStep',
    attacker: state.priorityWindow.attacker,
    defender: {
      ...state.priorityWindow.defender,
      defensePower: state.priorityWindow.defender.defensePower + counterAmount,
    },
  };

  return {
    state: { ...state, players: newPlayers, priorityWindow: updatedWindow },
    events: [{ kind: 'CounterPlayed', player: defenderOwner, cardId, counterAmount }],
  };
}

export function declineCounter(
  state: GameState,
  action: Extract<Action, { kind: 'DeclineCounter' }>,
): CounterResult {
  if (state.priorityWindow?.kind !== 'CounterStep') {
    return { state, events: [], error: { code: 'NotYourPriority' } };
  }
  if (action.player !== state.priorityWindow.defender.owner) {
    return { state, events: [], error: { code: 'NotYourPriority' } };
  }
  const { attacker, defender } = state.priorityWindow;
  // Before resolving combat, check whether the defender has any usable Blocker.
  // If so, open a BlockerStep. Simplification (plan §12): Blocker redirect does
  // NOT re-open Counter Step; the redirected attack resolves directly.
  const blockers = availableBlockers(state, defender.owner, defender);
  if (blockers.length > 0) {
    return {
      state: {
        ...state,
        priorityWindow: {
          kind: 'BlockerStep',
          attacker,
          originalTarget: defender,
        },
      },
      events: [],
    };
  }
  const resolved = resolveCombat({ ...state, priorityWindow: null }, attacker, defender);
  return { state: resolved.state, events: resolved.events };
}
