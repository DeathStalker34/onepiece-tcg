import type { GameState, PlayerIndex, AttackerRef, DefenderRef } from '../types/state';
import type { Action } from '../types/action';
import type { GameEvent } from '../types/event';
import type { EngineError } from '../types/error';
import type { CardStatic } from '../types/card';

export interface CombatResult {
  state: GameState;
  events: GameEvent[];
  error?: EngineError;
}

function powerOf(card: CardStatic): number {
  return card.power ?? 0;
}

function computeAttackPower(
  baseCard: CardStatic,
  attachedDon: number,
  powerThisTurn: number,
): number {
  return powerOf(baseCard) + attachedDon * 1000 + powerThisTurn;
}

export function declareAttack(
  state: GameState,
  action: Extract<Action, { kind: 'DeclareAttack' }>,
): CombatResult {
  if (state.phase !== 'Main') {
    return {
      state,
      events: [],
      error: { code: 'WrongPhase', expected: ['Main'], actual: state.phase },
    };
  }
  if (state.priorityWindow !== null) {
    return { state, events: [], error: { code: 'NotYourPriority' } };
  }
  if (state.activePlayer !== action.player) {
    return { state, events: [], error: { code: 'NotYourPriority' } };
  }

  const attackerOwner = action.player;
  const defenderOwner: PlayerIndex = attackerOwner === 0 ? 1 : 0;
  const ap = state.players[attackerOwner];
  const dp = state.players[defenderOwner];

  let attackerPower = 0;
  let attackerRef: AttackerRef;
  let updatedAttackerPlayer = ap;

  if (action.attacker.kind === 'Leader') {
    if (ap.leader.rested) {
      return { state, events: [], error: { code: 'CharacterIsRested' } };
    }
    const leaderCard = state.catalog[ap.leader.cardId];
    if (!leaderCard)
      return { state, events: [], error: { code: 'Unknown', detail: 'leader not in catalog' } };
    attackerPower = computeAttackPower(leaderCard, ap.leader.attachedDon, ap.leader.powerThisTurn);
    attackerRef = {
      owner: attackerOwner,
      source: { kind: 'Leader' },
      attackPower: attackerPower,
    };
    updatedAttackerPlayer = { ...ap, leader: { ...ap.leader, rested: true } };
  } else {
    const attackerInstanceId = action.attacker.instanceId;
    const idx = ap.characters.findIndex((c) => c.instanceId === attackerInstanceId);
    if (idx === -1) {
      return { state, events: [], error: { code: 'InvalidTarget', reason: 'attacker not found' } };
    }
    const char = ap.characters[idx];
    if (char.rested) return { state, events: [], error: { code: 'CharacterIsRested' } };
    if (char.summoningSickness) return { state, events: [], error: { code: 'SummoningSickness' } };
    const charCard = state.catalog[char.cardId];
    if (!charCard)
      return {
        state,
        events: [],
        error: { code: 'Unknown', detail: 'character card not in catalog' },
      };
    attackerPower = computeAttackPower(charCard, char.attachedDon, char.powerThisTurn);
    attackerRef = {
      owner: attackerOwner,
      source: { kind: 'Character', instanceId: char.instanceId },
      attackPower: attackerPower,
    };
    const newChars = [...ap.characters];
    newChars[idx] = { ...char, rested: true };
    updatedAttackerPlayer = { ...ap, characters: newChars };
  }

  let defensePower = 0;
  let defenderRef: DefenderRef;

  if (action.target.kind === 'Leader') {
    const leaderCard = state.catalog[dp.leader.cardId];
    if (!leaderCard)
      return {
        state,
        events: [],
        error: { code: 'Unknown', detail: 'target leader not in catalog' },
      };
    defensePower = powerOf(leaderCard);
    defenderRef = { owner: defenderOwner, target: { kind: 'Leader' }, defensePower };
  } else {
    if (action.target.owner !== defenderOwner) {
      return {
        state,
        events: [],
        error: { code: 'InvalidTarget', reason: 'target owner mismatch' },
      };
    }
    const targetInstanceId = action.target.instanceId;
    const idx = dp.characters.findIndex((c) => c.instanceId === targetInstanceId);
    if (idx === -1) {
      return {
        state,
        events: [],
        error: { code: 'InvalidTarget', reason: 'target character not found' },
      };
    }
    const ch = dp.characters[idx];
    if (!ch.rested) {
      return {
        state,
        events: [],
        error: { code: 'InvalidTarget', reason: 'character must be rested to be targeted' },
      };
    }
    const chCard = state.catalog[ch.cardId];
    if (!chCard)
      return {
        state,
        events: [],
        error: { code: 'Unknown', detail: 'target character card not in catalog' },
      };
    defensePower = powerOf(chCard);
    defenderRef = {
      owner: defenderOwner,
      target: { kind: 'Character', instanceId: ch.instanceId },
      defensePower,
    };
  }

  const newPlayers = state.players.map((p, i) =>
    i === attackerOwner ? updatedAttackerPlayer : p,
  ) as GameState['players'];

  const newState: GameState = {
    ...state,
    players: newPlayers,
    priorityWindow: { kind: 'CounterStep', attacker: attackerRef, defender: defenderRef },
  };

  const attackerLabel =
    action.attacker.kind === 'Leader' ? ap.leader.cardId : action.attacker.instanceId;
  const targetLabel = action.target.kind === 'Leader' ? dp.leader.cardId : action.target.instanceId;

  return {
    state: newState,
    events: [
      {
        kind: 'AttackDeclared',
        attacker: attackerLabel,
        target: targetLabel,
        power: attackerPower,
      },
    ],
  };
}
