import type { GameState, PlayerIndex, CharacterInPlay, TargetRef } from '../types/state';
import type { Effect, TargetSpec, CardFilter, CardStatic } from '../types/card';
import type { GameEvent } from '../types/event';
import { validTargetsForEffect } from './targets';

export interface EffectContext {
  sourcePlayer: PlayerIndex;
  sourceCardId: string;
}

export interface EffectResult {
  state: GameState;
  events: GameEvent[];
}

function otherPlayer(p: PlayerIndex): PlayerIndex {
  return p === 0 ? 1 : 0;
}

function matchesFilter(card: CardStatic, filter: CardFilter | undefined): boolean {
  if (!filter) return true;
  if (filter.type && card.type !== filter.type) return false;
  if (filter.colors && filter.colors.length > 0) {
    if (!filter.colors.some((c) => card.colors.includes(c))) return false;
  }
  if (filter.costMin !== undefined && (card.cost ?? 0) < filter.costMin) return false;
  if (filter.costMax !== undefined && (card.cost ?? 0) > filter.costMax) return false;
  if (filter.powerMin !== undefined && (card.power ?? 0) < filter.powerMin) return false;
  if (filter.powerMax !== undefined && (card.power ?? 0) > filter.powerMax) return false;
  if (filter.keyword && !card.keywords.includes(filter.keyword)) return false;
  return true;
}

// Keep findTargetCharacter for legacy use in applyPower (self/opponentLeader targets)
function findTargetCharacter(
  state: GameState,
  context: EffectContext,
  target: TargetSpec,
): { player: PlayerIndex; index: number } | null {
  if (target.kind === 'opponentCharacter') {
    const opp = otherPlayer(context.sourcePlayer);
    const chars = state.players[opp].characters;
    for (let i = 0; i < chars.length; i += 1) {
      const card = state.catalog[chars[i].cardId];
      if (card && matchesFilter(card, target.filter)) return { player: opp, index: i };
    }
    return null;
  }
  if (target.kind === 'ownCharacter') {
    const chars = state.players[context.sourcePlayer].characters;
    for (let i = 0; i < chars.length; i += 1) {
      const card = state.catalog[chars[i].cardId];
      if (card && matchesFilter(card, target.filter)) {
        return { player: context.sourcePlayer, index: i };
      }
    }
    return null;
  }
  return null;
}

function drawN(state: GameState, player: PlayerIndex, amount: number): GameState {
  const p = state.players[player];
  const n = Math.min(amount, p.deck.length);
  if (n === 0) return state;
  const drawn = p.deck.slice(0, n);
  const updated = {
    ...p,
    deck: p.deck.slice(n),
    hand: [...p.hand, ...drawn],
  };
  const newPlayers = state.players.map((pp, i) =>
    i === player ? updated : pp,
  ) as GameState['players'];
  return { ...state, players: newPlayers };
}

function removeCharacterAt(
  state: GameState,
  player: PlayerIndex,
  index: number,
  dest: 'trash' | 'banish' | 'hand',
): GameState {
  const p = state.players[player];
  const victim = p.characters[index];
  const newChars = [...p.characters.slice(0, index), ...p.characters.slice(index + 1)];
  let updated: typeof p = { ...p, characters: newChars };
  if (dest === 'trash') updated = { ...updated, trash: [...p.trash, victim.cardId] };
  else if (dest === 'banish')
    updated = { ...updated, banishZone: [...p.banishZone, victim.cardId] };
  else updated = { ...updated, hand: [...p.hand, victim.cardId] };
  const newPlayers = state.players.map((pp, i) =>
    i === player ? updated : pp,
  ) as GameState['players'];
  return { ...state, players: newPlayers };
}

function applyPowerToRef(state: GameState, target: TargetRef, delta: number): GameState {
  if (target.kind === 'Leader') {
    const p = state.players[target.owner];
    const updated = {
      ...p,
      leader: { ...p.leader, powerThisTurn: p.leader.powerThisTurn + delta },
    };
    const newPlayers = state.players.map((pp, i) =>
      i === target.owner ? updated : pp,
    ) as GameState['players'];
    return { ...state, players: newPlayers };
  }
  const p = state.players[target.owner];
  const idx = p.characters.findIndex((c) => c.instanceId === target.instanceId);
  if (idx < 0) return state;
  const newChars = [...p.characters];
  newChars[idx] = {
    ...newChars[idx],
    powerThisTurn: newChars[idx].powerThisTurn + delta,
  } as CharacterInPlay;
  const updated = { ...p, characters: newChars };
  const newPlayers = state.players.map((pp, i) =>
    i === target.owner ? updated : pp,
  ) as GameState['players'];
  return { ...state, players: newPlayers };
}

function applyPower(
  state: GameState,
  context: EffectContext,
  target: TargetSpec,
  delta: number,
): GameState {
  if (target.kind === 'self') {
    // "self" on an effect means source's owner leader (in this engine's simplified model)
    const p = state.players[context.sourcePlayer];
    const updated = {
      ...p,
      leader: { ...p.leader, powerThisTurn: p.leader.powerThisTurn + delta },
    };
    const newPlayers = state.players.map((pp, i) =>
      i === context.sourcePlayer ? updated : pp,
    ) as GameState['players'];
    return { ...state, players: newPlayers };
  }
  if (target.kind === 'opponentLeader') {
    const opp = otherPlayer(context.sourcePlayer);
    const p = state.players[opp];
    const updated = {
      ...p,
      leader: { ...p.leader, powerThisTurn: p.leader.powerThisTurn + delta },
    };
    const newPlayers = state.players.map((pp, i) =>
      i === opp ? updated : pp,
    ) as GameState['players'];
    return { ...state, players: newPlayers };
  }
  // Character target — use findTargetCharacter for single-target fallback
  const found = findTargetCharacter(state, context, target);
  if (!found) return state;
  const { player, index } = found;
  const p = state.players[player];
  const char = p.characters[index];
  const newChar: CharacterInPlay = { ...char, powerThisTurn: char.powerThisTurn + delta };
  const newChars = [...p.characters];
  newChars[index] = newChar;
  const updated = { ...p, characters: newChars };
  const newPlayers = state.players.map((pp, i) =>
    i === player ? updated : pp,
  ) as GameState['players'];
  return { ...state, players: newPlayers };
}

function applySearch(
  state: GameState,
  context: EffectContext,
  from: 'deck' | 'trash',
  filter: CardFilter,
  amount: number,
): GameState {
  const p = state.players[context.sourcePlayer];
  const pool = from === 'deck' ? p.deck : p.trash;
  const picked: string[] = [];
  const remaining: string[] = [];
  for (const id of pool) {
    if (picked.length < amount) {
      const card = state.catalog[id];
      if (card && matchesFilter(card, filter)) {
        picked.push(id);
        continue;
      }
    }
    remaining.push(id);
  }
  const updated = {
    ...p,
    hand: [...p.hand, ...picked],
    deck: from === 'deck' ? remaining : p.deck,
    trash: from === 'trash' ? remaining : p.trash,
  };
  const newPlayers = state.players.map((pp, i) =>
    i === context.sourcePlayer ? updated : pp,
  ) as GameState['players'];
  return { ...state, players: newPlayers };
}

/**
 * Resolves a targeted effect against a specific already-chosen TargetRef.
 * Called by SelectEffectTarget handler (Task 13) after the player picks a target.
 */
export function resolveDirectly(
  state: GameState,
  effect: Effect,
  context: EffectContext,
  target: TargetRef,
): EffectResult {
  let next = state;
  if (effect.kind === 'ko' && target.kind === 'Character') {
    const idx = state.players[target.owner].characters.findIndex(
      (c) => c.instanceId === target.instanceId,
    );
    if (idx >= 0) next = removeCharacterAt(state, target.owner, idx, 'trash');
  } else if (effect.kind === 'banish' && target.kind === 'Character') {
    const idx = state.players[target.owner].characters.findIndex(
      (c) => c.instanceId === target.instanceId,
    );
    if (idx >= 0) next = removeCharacterAt(state, target.owner, idx, 'banish');
  } else if (effect.kind === 'returnToHand' && target.kind === 'Character') {
    const idx = state.players[target.owner].characters.findIndex(
      (c) => c.instanceId === target.instanceId,
    );
    if (idx >= 0) next = removeCharacterAt(state, target.owner, idx, 'hand');
  } else if (effect.kind === 'power') {
    next = applyPowerToRef(state, target, effect.delta);
  }
  return {
    state: next,
    events: [{ kind: 'EffectResolved', effect, sourceCardId: context.sourceCardId }],
  };
}

/**
 * Handles targeted effects (ko/banish/returnToHand/power) with target-selection logic:
 * - 0 targets → fizzle (no state change, no events)
 * - 1 target + mandatory → resolve directly
 * - 1+ targets + optional OR 2+ targets → open EffectTargetSelection window
 */
function resolveTargetedEffect(
  state: GameState,
  effect: Effect & { kind: 'ko' | 'banish' | 'returnToHand' | 'power' },
  context: EffectContext,
): EffectResult {
  // For power effects with self/opponentLeader targets, fall through to legacy applyPower
  // (these are single deterministic targets, not character selections)
  if (
    effect.kind === 'power' &&
    (effect.target.kind === 'self' || effect.target.kind === 'opponentLeader')
  ) {
    const next = applyPower(state, context, effect.target, effect.delta);
    return {
      state: next,
      events: [{ kind: 'EffectResolved', effect, sourceCardId: context.sourceCardId }],
    };
  }

  const targets = validTargetsForEffect(state, context, effect);
  const optional = (effect as { optional?: boolean }).optional ?? false;

  if (targets.length === 0) {
    // Fizzle — no state change, no events
    return { state, events: [] };
  }

  if (targets.length === 1 && !optional) {
    return resolveDirectly(state, effect, context, targets[0]);
  }

  // Open EffectTargetSelection window
  const newState: GameState = {
    ...state,
    priorityWindow: {
      kind: 'EffectTargetSelection',
      sourceCardId: context.sourceCardId,
      sourceOwner: context.sourcePlayer,
      effect,
      validTargets: targets,
      optional,
      pendingChain: [],
    },
  };
  return { state: newState, events: [] };
}

export function applyEffect(
  state: GameState,
  effect: Effect,
  context: EffectContext,
): EffectResult {
  const events: GameEvent[] = [];
  let next = state;

  switch (effect.kind) {
    case 'draw':
      next = drawN(state, context.sourcePlayer, effect.amount);
      events.push({ kind: 'EffectResolved', effect, sourceCardId: context.sourceCardId });
      break;
    case 'ko':
    case 'banish':
    case 'returnToHand':
    case 'power':
      return resolveTargetedEffect(state, effect, context);
    case 'search':
      next = applySearch(state, context, effect.from, effect.filter, effect.amount);
      events.push({ kind: 'EffectResolved', effect, sourceCardId: context.sourceCardId });
      break;
    case 'sequence': {
      for (const step of effect.steps) {
        const r = applyEffect(next, step, context);
        next = r.state;
        events.push(...r.events);
      }
      events.push({ kind: 'EffectResolved', effect, sourceCardId: context.sourceCardId });
      break;
    }
    case 'choice': {
      if (effect.options.length > 0) {
        const r = applyEffect(next, effect.options[0], context);
        next = r.state;
        events.push(...r.events);
      }
      events.push({ kind: 'EffectResolved', effect, sourceCardId: context.sourceCardId });
      break;
    }
    case 'manual':
      // no-op; UI resolves manually
      events.push({ kind: 'EffectResolved', effect, sourceCardId: context.sourceCardId });
      break;
    default: {
      const exhaustive: never = effect;
      throw new Error(`Unhandled effect kind: ${JSON.stringify(exhaustive)}`);
    }
  }

  return { state: next, events };
}
