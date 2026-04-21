import type { GameState, PlayerIndex, CharacterInPlay } from '../types/state';
import type { Effect, TargetSpec, CardFilter, CardStatic } from '../types/card';
import type { GameEvent } from '../types/event';

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
  if (filter.keyword && !card.keywords.includes(filter.keyword)) return false;
  return true;
}

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
  // Character target
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
      break;
    case 'ko': {
      const found = findTargetCharacter(state, context, effect.target);
      if (found) next = removeCharacterAt(state, found.player, found.index, 'trash');
      break;
    }
    case 'banish': {
      const found = findTargetCharacter(state, context, effect.target);
      if (found) next = removeCharacterAt(state, found.player, found.index, 'banish');
      break;
    }
    case 'returnToHand': {
      const found = findTargetCharacter(state, context, effect.target);
      if (found) next = removeCharacterAt(state, found.player, found.index, 'hand');
      break;
    }
    case 'power':
      next = applyPower(state, context, effect.target, effect.delta);
      break;
    case 'search':
      next = applySearch(state, context, effect.from, effect.filter, effect.amount);
      break;
    case 'sequence': {
      for (const step of effect.steps) {
        const r = applyEffect(next, step, context);
        next = r.state;
        events.push(...r.events);
      }
      break;
    }
    case 'choice': {
      if (effect.options.length > 0) {
        const r = applyEffect(next, effect.options[0], context);
        next = r.state;
        events.push(...r.events);
      }
      break;
    }
    case 'manual':
      // no-op; UI resolves manually
      break;
    default: {
      const exhaustive: never = effect;
      throw new Error(`Unhandled effect kind: ${JSON.stringify(exhaustive)}`);
    }
  }

  events.push({ kind: 'EffectResolved', effect, sourceCardId: context.sourceCardId });
  return { state: next, events };
}
