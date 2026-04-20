import type { GameState, PlayerIndex, CharacterInPlay } from '../types/state';
import type { Action } from '../types/action';
import type { GameEvent } from '../types/event';
import type { EngineError } from '../types/error';
import type { CardStatic } from '../types/card';
import { nextInt } from '../rng';

export interface MainResult {
  state: GameState;
  events: GameEvent[];
  error?: EngineError;
}

function guardMain(state: GameState, player: PlayerIndex): EngineError | null {
  if (state.phase !== 'Main') {
    return { code: 'WrongPhase', expected: ['Main'], actual: state.phase };
  }
  if (state.priorityWindow !== null) {
    return { code: 'NotYourPriority' };
  }
  if (state.activePlayer !== player) {
    return { code: 'NotYourPriority' };
  }
  return null;
}

function checkCostAndColor(
  state: GameState,
  player: PlayerIndex,
  card: CardStatic,
  donSpent: number,
): EngineError | null {
  const cost = card.cost ?? 0;
  if (cost < 0) return { code: 'Unknown', detail: 'negative cost' };
  const effectiveCost = Math.max(0, cost - donSpent);
  const p = state.players[player];
  if (p.donActive < effectiveCost) {
    return { code: 'NotEnoughDon', need: effectiveCost, have: p.donActive };
  }
  // Color compatibility with leader
  const leaderStatic = state.catalog[p.leader.cardId];
  if (!leaderStatic) return { code: 'Unknown', detail: 'leader not in catalog' };
  const shared = card.colors.some((c) => leaderStatic.colors.includes(c));
  if (!shared) return { code: 'ColorMismatch' };
  return null;
}

function allocateInstanceId(state: GameState): { id: string; state: GameState } {
  const { value, rng } = nextInt(state.rng, 0xffffffff);
  const id = `inst-${value.toString(16)}`;
  return { id, state: { ...state, rng } };
}

export function playCharacter(
  state: GameState,
  action: Extract<Action, { kind: 'PlayCharacter' }>,
): MainResult {
  const guard = guardMain(state, action.player);
  if (guard) return { state, events: [], error: guard };

  const p = state.players[action.player];
  const cardId = p.hand[action.handIndex];
  if (!cardId) return { state, events: [], error: { code: 'CardNotInHand' } };
  const card = state.catalog[cardId];
  if (!card)
    return { state, events: [], error: { code: 'Unknown', detail: 'card not in catalog' } };
  if (card.type !== 'CHARACTER') {
    return {
      state,
      events: [],
      error: { code: 'InvalidTarget', reason: `expected CHARACTER, got ${card.type}` },
    };
  }
  const costErr = checkCostAndColor(state, action.player, card, action.donSpent);
  if (costErr) return { state, events: [], error: costErr };
  if (p.characters.length >= 5) {
    return { state, events: [], error: { code: 'MaxCharactersReached', limit: 5 } };
  }

  const effectiveCost = Math.max(0, (card.cost ?? 0) - action.donSpent);
  const { id, state: afterId } = allocateInstanceId(state);

  const newChar: CharacterInPlay = {
    instanceId: id,
    cardId,
    rested: false,
    attachedDon: action.donSpent,
    powerThisTurn: 0,
    summoningSickness: !card.keywords.includes('Rush'),
    usedBlockerThisTurn: false,
  };

  const newHand = [...p.hand.slice(0, action.handIndex), ...p.hand.slice(action.handIndex + 1)];
  const updatedPlayer = {
    ...p,
    hand: newHand,
    donActive: p.donActive - effectiveCost,
    characters: [...p.characters, newChar],
  };
  const nextPlayers = afterId.players.map((pp, i) =>
    i === action.player ? updatedPlayer : pp,
  ) as GameState['players'];

  return {
    state: { ...afterId, players: nextPlayers },
    events: [{ kind: 'CardPlayed', player: action.player, cardId, donSpent: action.donSpent }],
  };
}

export function playEvent(
  state: GameState,
  action: Extract<Action, { kind: 'PlayEvent' }>,
): MainResult {
  const guard = guardMain(state, action.player);
  if (guard) return { state, events: [], error: guard };

  const p = state.players[action.player];
  const cardId = p.hand[action.handIndex];
  if (!cardId) return { state, events: [], error: { code: 'CardNotInHand' } };
  const card = state.catalog[cardId];
  if (!card)
    return { state, events: [], error: { code: 'Unknown', detail: 'card not in catalog' } };
  if (card.type !== 'EVENT') {
    return {
      state,
      events: [],
      error: { code: 'InvalidTarget', reason: `expected EVENT, got ${card.type}` },
    };
  }
  const costErr = checkCostAndColor(state, action.player, card, action.donSpent);
  if (costErr) return { state, events: [], error: costErr };

  const effectiveCost = Math.max(0, (card.cost ?? 0) - action.donSpent);
  const newHand = [...p.hand.slice(0, action.handIndex), ...p.hand.slice(action.handIndex + 1)];
  const updatedPlayer = {
    ...p,
    hand: newHand,
    trash: [...p.trash, cardId],
    donActive: p.donActive - effectiveCost,
  };
  const nextPlayers = state.players.map((pp, i) =>
    i === action.player ? updatedPlayer : pp,
  ) as GameState['players'];

  return {
    state: { ...state, players: nextPlayers },
    events: [{ kind: 'CardPlayed', player: action.player, cardId, donSpent: action.donSpent }],
  };
}

export function playStage(
  state: GameState,
  action: Extract<Action, { kind: 'PlayStage' }>,
): MainResult {
  const guard = guardMain(state, action.player);
  if (guard) return { state, events: [], error: guard };

  const p = state.players[action.player];
  const cardId = p.hand[action.handIndex];
  if (!cardId) return { state, events: [], error: { code: 'CardNotInHand' } };
  const card = state.catalog[cardId];
  if (!card)
    return { state, events: [], error: { code: 'Unknown', detail: 'card not in catalog' } };
  if (card.type !== 'STAGE') {
    return {
      state,
      events: [],
      error: { code: 'InvalidTarget', reason: `expected STAGE, got ${card.type}` },
    };
  }
  const costErr = checkCostAndColor(state, action.player, card, action.donSpent);
  if (costErr) return { state, events: [], error: costErr };

  const effectiveCost = Math.max(0, (card.cost ?? 0) - action.donSpent);
  const newHand = [...p.hand.slice(0, action.handIndex), ...p.hand.slice(action.handIndex + 1)];
  const trashAddition = p.stage ? [p.stage.cardId] : [];
  const updatedPlayer = {
    ...p,
    hand: newHand,
    donActive: p.donActive - effectiveCost,
    stage: { cardId },
    trash: [...p.trash, ...trashAddition],
  };
  const nextPlayers = state.players.map((pp, i) =>
    i === action.player ? updatedPlayer : pp,
  ) as GameState['players'];

  return {
    state: { ...state, players: nextPlayers },
    events: [{ kind: 'CardPlayed', player: action.player, cardId, donSpent: action.donSpent }],
  };
}
