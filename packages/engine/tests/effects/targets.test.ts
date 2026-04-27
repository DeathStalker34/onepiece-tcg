import { describe, it, expect } from 'vitest';
import { validTargetsForEffect } from '../../src/effects/targets';
import type { GameState, PlayerState, CharacterInPlay } from '../../src/types/state';
import type { CardStatic, Effect } from '../../src/types/card';

const RED_CHAR: CardStatic = {
  id: 'C',
  type: 'CHARACTER',
  colors: ['Red'],
  cost: 3,
  power: 4000,
  life: null,
  counter: 1000,
  keywords: [],
  effects: [],
  manualText: null,
};
const BIG_CHAR: CardStatic = {
  id: 'B',
  type: 'CHARACTER',
  colors: ['Red'],
  cost: 5,
  power: 7000,
  life: null,
  counter: 1000,
  keywords: [],
  effects: [],
  manualText: null,
};

function makeChar(instanceId: string, cardId: string): CharacterInPlay {
  return {
    instanceId,
    cardId,
    rested: false,
    attachedDon: 0,
    powerThisTurn: 0,
    summoningSickness: false,
    usedBlockerThisTurn: false,
  };
}

function makePlayer(chars: CharacterInPlay[]): PlayerState {
  return {
    playerId: 'p',
    leader: { cardId: 'L', rested: false, attachedDon: 0, powerThisTurn: 0 },
    deck: [],
    hand: [],
    life: [],
    trash: [],
    banishZone: [],
    characters: chars,
    stage: null,
    donActive: 0,
    donRested: 0,
    donDeck: 10,
    mulliganTaken: false,
    firstTurnUsed: false,
  };
}

function makeState(p0Chars: CharacterInPlay[], p1Chars: CharacterInPlay[]): GameState {
  return {
    turn: 1,
    activePlayer: 0,
    phase: 'Main',
    priorityWindow: null,
    players: [makePlayer(p0Chars), makePlayer(p1Chars)],
    rng: { seed: 1, pointer: 0 },
    log: [],
    winner: null,
    catalog: { C: RED_CHAR, B: BIG_CHAR },
    isFirstTurnOfFirstPlayer: false,
  };
}

describe('validTargetsForEffect', () => {
  it('returns opponent characters matching filter', () => {
    const state = makeState([], [makeChar('x1', 'C'), makeChar('x2', 'B')]);
    const effect: Effect = {
      kind: 'ko',
      target: { kind: 'opponentCharacter', filter: { powerMax: 4000 } },
    };
    const targets = validTargetsForEffect(state, { sourcePlayer: 0, sourceCardId: 'src' }, effect);
    expect(targets).toEqual([{ kind: 'Character', instanceId: 'x1', owner: 1 }]);
  });

  it('returns opponent leader for opponentLeader target', () => {
    const state = makeState([], []);
    const effect: Effect = {
      kind: 'power',
      target: { kind: 'opponentLeader' },
      delta: -1000,
      duration: 'thisTurn',
    };
    const targets = validTargetsForEffect(state, { sourcePlayer: 0, sourceCardId: 'src' }, effect);
    expect(targets).toEqual([{ kind: 'Leader', owner: 1 }]);
  });

  it('returns own characters for ownCharacter target', () => {
    const state = makeState([makeChar('o1', 'C')], []);
    const effect: Effect = {
      kind: 'power',
      target: { kind: 'ownCharacter' },
      delta: 1000,
      duration: 'thisTurn',
    };
    const targets = validTargetsForEffect(state, { sourcePlayer: 0, sourceCardId: 'src' }, effect);
    expect(targets).toEqual([{ kind: 'Character', instanceId: 'o1', owner: 0 }]);
  });

  it('returns source leader for self target', () => {
    const state = makeState([], []);
    const effect: Effect = {
      kind: 'power',
      target: { kind: 'self' },
      delta: 1000,
      duration: 'thisTurn',
    };
    const targets = validTargetsForEffect(state, { sourcePlayer: 0, sourceCardId: 'src' }, effect);
    expect(targets).toEqual([{ kind: 'Leader', owner: 0 }]);
  });

  it('returns empty for non-target effects', () => {
    const state = makeState([], []);
    const effect: Effect = { kind: 'draw', amount: 1 };
    const targets = validTargetsForEffect(state, { sourcePlayer: 0, sourceCardId: 'src' }, effect);
    expect(targets).toEqual([]);
  });
});
