import { describe, it, expect } from 'vitest';
import { computeEffectivePower } from '../../src/effects/power';
import type { GameState, PlayerState, CharacterInPlay } from '../../src/types/state';
import type { CardStatic } from '../../src/types/card';

const ZORO_LEADER: CardStatic = {
  id: 'OP01-001',
  type: 'LEADER',
  colors: ['Red'],
  cost: null,
  power: 5000,
  life: 5,
  counter: null,
  keywords: [],
  effects: [
    {
      trigger: 'StaticAura',
      condition: { onTurn: 'yours', attachedDonAtLeast: 1 },
      effect: {
        kind: 'power',
        target: { kind: 'ownCharacter' },
        delta: 1000,
        duration: 'permanent',
      },
    },
  ],
  manualText: null,
};

const PLAIN_CHAR: CardStatic = {
  id: 'OP01-006',
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

function makeChar(id: string, cardId: string, attachedDon = 0): CharacterInPlay {
  return {
    instanceId: id,
    cardId,
    rested: false,
    attachedDon,
    powerThisTurn: 0,
    summoningSickness: false,
    usedBlockerThisTurn: false,
  };
}

function makePlayer(leaderId: string, leaderDon: number, chars: CharacterInPlay[]): PlayerState {
  return {
    playerId: 'p',
    leader: {
      cardId: leaderId,
      rested: false,
      attachedDon: leaderDon,
      powerThisTurn: 0,
    },
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

function makeState(activePlayer: 0 | 1, p0Don: number, p0Chars: CharacterInPlay[]): GameState {
  return {
    turn: 1,
    activePlayer,
    phase: 'Main',
    priorityWindow: null,
    players: [makePlayer('OP01-001', p0Don, p0Chars), makePlayer('OP01-001', 0, [])],
    rng: { seed: 1, pointer: 0 },
    log: [],
    winner: null,
    catalog: { 'OP01-001': ZORO_LEADER, 'OP01-006': PLAIN_CHAR },
    isFirstTurnOfFirstPlayer: false,
  };
}

describe('computeEffectivePower', () => {
  it('returns base power when no auras active', () => {
    const state = makeState(0, 0, [makeChar('x', 'OP01-006')]);
    const power = computeEffectivePower(state, {
      kind: 'Character',
      instanceId: 'x',
      owner: 0,
    });
    expect(power).toBe(4000);
  });

  it('applies aura when condition holds (own turn + 1 don on leader)', () => {
    const state = makeState(0, 1, [makeChar('x', 'OP01-006')]);
    const power = computeEffectivePower(state, {
      kind: 'Character',
      instanceId: 'x',
      owner: 0,
    });
    expect(power).toBe(5000); // 4000 + 1000 aura
  });

  it('does not apply aura on opponent turn', () => {
    const state = makeState(1, 1, [makeChar('x', 'OP01-006')]);
    const power = computeEffectivePower(state, {
      kind: 'Character',
      instanceId: 'x',
      owner: 0,
    });
    expect(power).toBe(4000);
  });

  it('does not apply aura when leader has 0 don attached', () => {
    const state = makeState(0, 0, [makeChar('x', 'OP01-006')]);
    const power = computeEffectivePower(state, {
      kind: 'Character',
      instanceId: 'x',
      owner: 0,
    });
    expect(power).toBe(4000);
  });

  it('includes attachedDon and powerThisTurn on the target', () => {
    const state = makeState(0, 0, [makeChar('x', 'OP01-006', 2)]);
    const power = computeEffectivePower(state, {
      kind: 'Character',
      instanceId: 'x',
      owner: 0,
    });
    expect(power).toBe(6000); // 4000 + 2*1000
  });

  it('computes leader power (aura targets ownChar, not self leader)', () => {
    const state = makeState(0, 1, []);
    const power = computeEffectivePower(state, { kind: 'Leader', owner: 0 });
    expect(power).toBe(6000); // 5000 + 1*1000 attached, aura ineligible
  });

  it('clamps result to non-negative', () => {
    // Synthetic: a debuff aura that would drive power below 0
    const debuffLeader: CardStatic = {
      ...ZORO_LEADER,
      id: 'X',
      effects: [
        {
          trigger: 'StaticAura',
          effect: {
            kind: 'power',
            target: { kind: 'ownCharacter' },
            delta: -10000,
            duration: 'permanent',
          },
        },
      ],
    };
    const state: GameState = {
      ...makeState(0, 0, [makeChar('x', 'OP01-006')]),
      catalog: { X: debuffLeader, 'OP01-006': PLAIN_CHAR },
      players: [{ ...makePlayer('X', 0, [makeChar('x', 'OP01-006')]) }, makePlayer('X', 0, [])],
    };
    const power = computeEffectivePower(state, {
      kind: 'Character',
      instanceId: 'x',
      owner: 0,
    });
    expect(power).toBe(0);
  });
});
