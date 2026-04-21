import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/setup';
import { apply } from '../src/apply';
import type { GameState, MatchSetup, CharacterInPlay } from '../src/types/state';
import { TEST_CATALOG } from './fixtures/test-cards';
import { simpleRedDeck50 } from './fixtures/simple-red-deck';

function mkSetup(seed = 42): MatchSetup {
  return {
    seed,
    firstPlayer: 0,
    players: [
      { playerId: 'p0', leaderCardId: 'TEST-LEADER-01', deck: simpleRedDeck50() },
      { playerId: 'p1', leaderCardId: 'TEST-LEADER-02', deck: simpleRedDeck50() },
    ],
    catalog: TEST_CATALOG,
  };
}

function postMulliganInMain(): GameState {
  let s = createInitialState(mkSetup());
  s = apply(s, { kind: 'Mulligan', player: 0, mulligan: false }).state;
  s = apply(s, { kind: 'Mulligan', player: 1, mulligan: false }).state;
  s = apply(s, { kind: 'PassPhase', player: 0 }).state;
  s = apply(s, { kind: 'PassPhase', player: 0 }).state;
  s = apply(s, { kind: 'PassPhase', player: 0 }).state;
  return s;
}

function addChar(
  state: GameState,
  player: 0 | 1,
  overrides: Partial<CharacterInPlay> & Pick<CharacterInPlay, 'cardId' | 'instanceId'>,
): GameState {
  const defaults: CharacterInPlay = {
    instanceId: overrides.instanceId,
    cardId: overrides.cardId,
    rested: false,
    attachedDon: 0,
    powerThisTurn: 0,
    summoningSickness: false,
    usedBlockerThisTurn: false,
  };
  const char: CharacterInPlay = { ...defaults, ...overrides };
  return {
    ...state,
    players: state.players.map((p, i) =>
      i === player ? { ...p, characters: [...p.characters, char] } : p,
    ) as typeof state.players,
  };
}

describe('DeclareAttack — Leader target', () => {
  it('leader attacks opponent leader → priorityWindow=CounterStep', () => {
    const s0 = postMulliganInMain();
    const res = apply(s0, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Leader' },
      target: { kind: 'Leader' },
    });
    expect(res.error).toBeUndefined();
    expect(res.state.priorityWindow?.kind).toBe('CounterStep');
    expect(res.state.players[0].leader.rested).toBe(true);
  });

  it('rested leader cannot attack', () => {
    let s = postMulliganInMain();
    s = {
      ...s,
      players: [
        { ...s.players[0], leader: { ...s.players[0].leader, rested: true } },
        s.players[1],
      ] as typeof s.players,
    };
    const res = apply(s, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Leader' },
      target: { kind: 'Leader' },
    });
    expect(res.error?.code).toBe('CharacterIsRested');
  });
});

describe('DeclareAttack — Character attacker', () => {
  it('character with summoningSickness cannot attack', () => {
    let s = postMulliganInMain();
    s = addChar(s, 0, { instanceId: 'c1', cardId: 'TEST-CHAR-BASIC-01', summoningSickness: true });
    const res = apply(s, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Character', instanceId: 'c1' },
      target: { kind: 'Leader' },
    });
    expect(res.error?.code).toBe('SummoningSickness');
  });

  it('Rush character can attack on summoning turn', () => {
    let s = postMulliganInMain();
    s = addChar(s, 0, { instanceId: 'c1', cardId: 'TEST-CHAR-RUSH', summoningSickness: false });
    const res = apply(s, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Character', instanceId: 'c1' },
      target: { kind: 'Leader' },
    });
    expect(res.error).toBeUndefined();
    expect(res.state.players[0].characters[0].rested).toBe(true);
  });

  it('rested attacker errors', () => {
    let s = postMulliganInMain();
    s = addChar(s, 0, { instanceId: 'c1', cardId: 'TEST-CHAR-RUSH', rested: true });
    const res = apply(s, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Character', instanceId: 'c1' },
      target: { kind: 'Leader' },
    });
    expect(res.error?.code).toBe('CharacterIsRested');
  });

  it('target character active (rested=false) errors InvalidTarget', () => {
    let s = postMulliganInMain();
    s = addChar(s, 0, { instanceId: 'atk', cardId: 'TEST-CHAR-RUSH' });
    s = addChar(s, 1, { instanceId: 'def', cardId: 'TEST-CHAR-BASIC-01', rested: false });
    const res = apply(s, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Character', instanceId: 'atk' },
      target: { kind: 'Character', instanceId: 'def', owner: 1 },
    });
    expect(res.error?.code).toBe('InvalidTarget');
  });

  it('target character rested → legal attack', () => {
    let s = postMulliganInMain();
    s = addChar(s, 0, { instanceId: 'atk', cardId: 'TEST-CHAR-RUSH' });
    s = addChar(s, 1, { instanceId: 'def', cardId: 'TEST-CHAR-BASIC-01', rested: true });
    const res = apply(s, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Character', instanceId: 'atk' },
      target: { kind: 'Character', instanceId: 'def', owner: 1 },
    });
    expect(res.error).toBeUndefined();
    expect(res.state.priorityWindow?.kind).toBe('CounterStep');
  });

  it('attackPower = basePower + attachedDon*1000 + powerThisTurn', () => {
    let s = postMulliganInMain();
    s = addChar(s, 0, {
      instanceId: 'c1',
      cardId: 'TEST-CHAR-RUSH',
      attachedDon: 2,
      powerThisTurn: 500,
    });
    const res = apply(s, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Character', instanceId: 'c1' },
      target: { kind: 'Leader' },
    });
    const pw = res.state.priorityWindow;
    expect(pw?.kind).toBe('CounterStep');
    if (pw?.kind === 'CounterStep') {
      expect(pw.attacker.attackPower).toBe(5000 + 2000 + 500);
    }
  });
});

describe('Counter Step', () => {
  function postDeclareAttack(): GameState {
    const s0 = postMulliganInMain();
    return apply(s0, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Leader' },
      target: { kind: 'Leader' },
    }).state;
  }

  it('defender plays counter — defensePower increases, hand decreases, trash increases', () => {
    let s = postDeclareAttack();
    s = {
      ...s,
      players: [
        s.players[0],
        {
          ...s.players[1],
          hand: ['TEST-CHAR-COUNTER', ...s.players[1].hand.slice(1)],
        },
      ] as typeof s.players,
    };
    const pw0 = s.priorityWindow;
    if (pw0?.kind !== 'CounterStep') throw new Error('expected CounterStep');
    const startDef = pw0.defender.defensePower;
    const res = apply(s, { kind: 'PlayCounter', player: 1, handIndex: 0 });
    expect(res.error).toBeUndefined();
    expect(res.state.players[1].hand).not.toContain('TEST-CHAR-COUNTER');
    expect(res.state.players[1].trash).toContain('TEST-CHAR-COUNTER');
    const pw = res.state.priorityWindow;
    expect(pw?.kind).toBe('CounterStep');
    if (pw?.kind === 'CounterStep') {
      expect(pw.defender.defensePower).toBe(startDef + 2000);
    }
  });

  it('card without counter value fails', () => {
    let s = postDeclareAttack();
    s = {
      ...s,
      players: [s.players[0], { ...s.players[1], hand: ['TEST-LEADER-02'] }] as typeof s.players,
    };
    const res = apply(s, { kind: 'PlayCounter', player: 1, handIndex: 0 });
    expect(res.error).toBeDefined();
  });

  it('wrong player cannot play counter', () => {
    let s = postDeclareAttack();
    s = {
      ...s,
      players: [{ ...s.players[0], hand: ['TEST-CHAR-COUNTER'] }, s.players[1]] as typeof s.players,
    };
    const res = apply(s, { kind: 'PlayCounter', player: 0, handIndex: 0 });
    expect(res.error?.code).toBe('NotYourPriority');
  });

  it('declining counter closes the window (stub until Task 11)', () => {
    const s = postDeclareAttack();
    const res = apply(s, { kind: 'DeclineCounter', player: 1 });
    expect(res.error).toBeUndefined();
    expect(res.state.priorityWindow).toBeNull();
  });
});
