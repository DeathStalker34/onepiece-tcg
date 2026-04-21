import type { GameState, PlayerIndex, DefenderRef } from '../types/state';
import type { Action } from '../types/action';
import type { GameEvent } from '../types/event';
import type { EngineError } from '../types/error';
import { resolveCombat } from './resolve';

export interface BlockerResult {
  state: GameState;
  events: GameEvent[];
  error?: EngineError;
}

/**
 * Returns instanceIds of characters who can Blocker this turn.
 * - Must have Blocker keyword
 * - Must be active (rested=false)
 * - Must not have used blocker this turn
 * - Must not be the current target
 *
 * Simplification (Fase 3, per plan §12): blocker redirect does NOT re-open
 * Counter Step after the attack is redirected to the blocker. The redirected
 * combat resolves directly.
 */
export function availableBlockers(
  state: GameState,
  defender: PlayerIndex,
  currentTarget: DefenderRef,
): string[] {
  const p = state.players[defender];
  return p.characters
    .filter((c) => {
      if (c.rested) return false;
      if (c.usedBlockerThisTurn) return false;
      const card = state.catalog[c.cardId];
      if (!card) return false;
      if (!card.keywords.includes('Blocker')) return false;
      // Not the current target
      if (
        currentTarget.target.kind === 'Character' &&
        currentTarget.target.instanceId === c.instanceId
      ) {
        return false;
      }
      return true;
    })
    .map((c) => c.instanceId);
}

export function useBlocker(
  state: GameState,
  action: Extract<Action, { kind: 'UseBlocker' }>,
): BlockerResult {
  if (state.priorityWindow?.kind !== 'BlockerStep') {
    return { state, events: [], error: { code: 'NotYourPriority' } };
  }
  const defender = state.priorityWindow.originalTarget.owner;
  if (action.player !== defender) {
    return { state, events: [], error: { code: 'NotYourPriority' } };
  }

  const pl = state.players[defender];
  const idx = pl.characters.findIndex((c) => c.instanceId === action.blockerInstanceId);
  if (idx === -1) {
    return {
      state,
      events: [],
      error: { code: 'InvalidTarget', reason: 'blocker not found' },
    };
  }
  const blocker = pl.characters[idx];
  const blockerCard = state.catalog[blocker.cardId];
  if (!blockerCard || !blockerCard.keywords.includes('Blocker')) {
    return {
      state,
      events: [],
      error: { code: 'InvalidTarget', reason: 'character has no Blocker keyword' },
    };
  }
  if (blocker.rested || blocker.usedBlockerThisTurn) {
    return {
      state,
      events: [],
      error: { code: 'InvalidTarget', reason: 'blocker unavailable' },
    };
  }

  // Rest the blocker and mark used
  const newChars = [...pl.characters];
  newChars[idx] = { ...blocker, rested: true, usedBlockerThisTurn: true };
  const updatedPlayer = { ...pl, characters: newChars };
  const newPlayers = state.players.map((pp, i) =>
    i === defender ? updatedPlayer : pp,
  ) as GameState['players'];

  // New defender ref targets the blocker (base power only; Fase 3 scope — no
  // additional power modifiers from attachedDon/powerThisTurn on the blocker
  // for defense, per simplification in plan §12).
  const newDefender: DefenderRef = {
    owner: defender,
    target: { kind: 'Character', instanceId: blocker.instanceId },
    defensePower: blockerCard.power ?? 0,
  };

  const resolved = resolveCombat(
    { ...state, players: newPlayers, priorityWindow: null },
    state.priorityWindow.attacker,
    newDefender,
  );

  return {
    state: resolved.state,
    events: [{ kind: 'BlockerUsed', blockerInstanceId: blocker.instanceId }, ...resolved.events],
  };
}

export function declineBlocker(
  state: GameState,
  action: Extract<Action, { kind: 'DeclineBlocker' }>,
): BlockerResult {
  if (state.priorityWindow?.kind !== 'BlockerStep') {
    return { state, events: [], error: { code: 'NotYourPriority' } };
  }
  if (action.player !== state.priorityWindow.originalTarget.owner) {
    return { state, events: [], error: { code: 'NotYourPriority' } };
  }
  const resolved = resolveCombat(
    { ...state, priorityWindow: null },
    state.priorityWindow.attacker,
    state.priorityWindow.originalTarget,
  );
  return resolved;
}
