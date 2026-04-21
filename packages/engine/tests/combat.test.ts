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

describe('Combat resolve', () => {
  function setupLeaderAttack(): GameState {
    const s = postMulliganInMain();
    return apply(s, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Leader' },
      target: { kind: 'Leader' },
    }).state;
  }

  it('attacker >= defender on Leader → Life -1, revealed card to hand (no Trigger)', () => {
    const s = setupLeaderAttack();
    // TEST-LEADER-01 power 5000 vs TEST-LEADER-02 power 5000 → attacker >= defender (equal)
    // Seed life to a known card without Trigger effect (e.g. TEST-CHAR-BASIC-01)
    const sWithLife = {
      ...s,
      players: [
        s.players[0],
        {
          ...s.players[1],
          life: [
            'TEST-CHAR-BASIC-01',
            'TEST-CHAR-BASIC-02',
            'TEST-CHAR-BASIC-01',
            'TEST-CHAR-BASIC-02',
          ],
        },
      ] as typeof s.players,
    };
    const res = apply(sWithLife, { kind: 'DeclineCounter', player: 1 });
    expect(res.error).toBeUndefined();
    expect(res.state.players[1].life.length).toBe(3);
    expect(res.state.players[1].hand).toContain('TEST-CHAR-BASIC-01');
    expect(res.state.priorityWindow).toBeNull();
  });

  it('attacker < defender → no damage, just close window', () => {
    let s = postMulliganInMain();
    // Give attacker leader negative powerThisTurn so attack fails
    s = {
      ...s,
      players: [
        { ...s.players[0], leader: { ...s.players[0].leader, powerThisTurn: -10000 } },
        s.players[1],
      ] as typeof s.players,
    };
    const sAfterAttack = apply(s, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Leader' },
      target: { kind: 'Leader' },
    }).state;
    const res = apply(sAfterAttack, { kind: 'DeclineCounter', player: 1 });
    expect(res.error).toBeUndefined();
    // No life loss
    expect(res.state.players[1].life.length).toBe(4);
    expect(res.state.priorityWindow).toBeNull();
  });

  it('Life reveals a Trigger card → priorityWindow=TriggerStep', () => {
    const s = setupLeaderAttack();
    // Top of life = TEST-CHAR-TRIGGER-DRAW (has Trigger: draw 1)
    const sWithLife = {
      ...s,
      players: [
        s.players[0],
        {
          ...s.players[1],
          life: [
            'TEST-CHAR-TRIGGER-DRAW',
            'TEST-CHAR-BASIC-01',
            'TEST-CHAR-BASIC-01',
            'TEST-CHAR-BASIC-01',
          ],
        },
      ] as typeof s.players,
    };
    const res = apply(sWithLife, { kind: 'DeclineCounter', player: 1 });
    expect(res.error).toBeUndefined();
    const pw = res.state.priorityWindow;
    expect(pw?.kind).toBe('TriggerStep');
    if (pw?.kind === 'TriggerStep') {
      expect(pw.revealedCardId).toBe('TEST-CHAR-TRIGGER-DRAW');
      expect(pw.owner).toBe(1);
    }
  });

  it('ActivateTrigger true → effect runs, revealed card goes to hand', () => {
    const s = setupLeaderAttack();
    const sWithLife = {
      ...s,
      players: [
        s.players[0],
        {
          ...s.players[1],
          life: [
            'TEST-CHAR-TRIGGER-DRAW',
            'TEST-CHAR-BASIC-01',
            'TEST-CHAR-BASIC-01',
            'TEST-CHAR-BASIC-01',
          ],
        },
      ] as typeof s.players,
    };
    const s2 = apply(sWithLife, { kind: 'DeclineCounter', player: 1 }).state;
    const handBefore = s2.players[1].hand.length;
    const res = apply(s2, { kind: 'ActivateTrigger', player: 1, activate: true });
    expect(res.error).toBeUndefined();
    // Trigger was "draw 1" — hand should have +1 (revealed card) + 1 (draw effect) = +2
    expect(res.state.players[1].hand.length).toBe(handBefore + 2);
    expect(res.state.players[1].hand).toContain('TEST-CHAR-TRIGGER-DRAW');
    expect(res.state.priorityWindow).toBeNull();
  });

  it('ActivateTrigger false → card to hand, no effect', () => {
    const s = setupLeaderAttack();
    const sWithLife = {
      ...s,
      players: [
        s.players[0],
        {
          ...s.players[1],
          life: [
            'TEST-CHAR-TRIGGER-DRAW',
            'TEST-CHAR-BASIC-01',
            'TEST-CHAR-BASIC-01',
            'TEST-CHAR-BASIC-01',
          ],
        },
      ] as typeof s.players,
    };
    const s2 = apply(sWithLife, { kind: 'DeclineCounter', player: 1 }).state;
    const handBefore = s2.players[1].hand.length;
    const res = apply(s2, { kind: 'ActivateTrigger', player: 1, activate: false });
    expect(res.error).toBeUndefined();
    expect(res.state.players[1].hand.length).toBe(handBefore + 1);
    expect(res.state.priorityWindow).toBeNull();
  });

  it('Life 0 after hit → winner set, phase GameOver', () => {
    const s = setupLeaderAttack();
    const sNoLife = {
      ...s,
      players: [s.players[0], { ...s.players[1], life: [] }] as typeof s.players,
    };
    const res = apply(sNoLife, { kind: 'DeclineCounter', player: 1 });
    expect(res.error).toBeUndefined();
    expect(res.state.winner).toBe(0);
    expect(res.state.phase).toBe('GameOver');
  });

  it('DoubleAttack on Leader → Life -2', () => {
    let s = postMulliganInMain();
    s = addChar(s, 0, {
      instanceId: 'atk',
      cardId: 'TEST-CHAR-DOUBLEATTACK',
      summoningSickness: false,
    });
    // Give p1 life with no triggers
    s = {
      ...s,
      players: [
        s.players[0],
        {
          ...s.players[1],
          life: [
            'TEST-CHAR-BASIC-01',
            'TEST-CHAR-BASIC-02',
            'TEST-CHAR-BASIC-01',
            'TEST-CHAR-BASIC-02',
          ],
        },
      ] as typeof s.players,
    };
    const s2 = apply(s, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Character', instanceId: 'atk' },
      target: { kind: 'Leader' },
    }).state;
    const res = apply(s2, { kind: 'DeclineCounter', player: 1 });
    expect(res.error).toBeUndefined();
    expect(res.state.players[1].life.length).toBe(2); // lost 2
  });

  it('Character target KO → to trash (no Banish)', () => {
    let s = postMulliganInMain();
    s = addChar(s, 0, { instanceId: 'atk', cardId: 'TEST-CHAR-RUSH' });
    s = addChar(s, 1, { instanceId: 'def', cardId: 'TEST-CHAR-BASIC-01', rested: true });
    const s2 = apply(s, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Character', instanceId: 'atk' },
      target: { kind: 'Character', instanceId: 'def', owner: 1 },
    }).state;
    const res = apply(s2, { kind: 'DeclineCounter', player: 1 });
    expect(res.error).toBeUndefined();
    expect(res.state.players[1].characters.length).toBe(0);
    expect(res.state.players[1].trash).toContain('TEST-CHAR-BASIC-01');
    expect(res.state.players[1].banishZone).toEqual([]);
  });

  it('Banish keyword → KO goes to banishZone', () => {
    let s = postMulliganInMain();
    s = addChar(s, 0, { instanceId: 'atk', cardId: 'TEST-CHAR-DOUBLEATTACK' }); // 6000 power
    s = addChar(s, 1, { instanceId: 'def', cardId: 'TEST-CHAR-BANISH', rested: true });
    const s2 = apply(s, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Character', instanceId: 'atk' },
      target: { kind: 'Character', instanceId: 'def', owner: 1 },
    }).state;
    const res = apply(s2, { kind: 'DeclineCounter', player: 1 });
    expect(res.error).toBeUndefined();
    expect(res.state.players[1].characters.length).toBe(0);
    expect(res.state.players[1].banishZone).toContain('TEST-CHAR-BANISH');
    expect(res.state.players[1].trash).not.toContain('TEST-CHAR-BANISH');
  });
});

describe('OnKO wiring', () => {
  it('KO a TEST-CHAR-ONKO-BANISH character triggers banish of opponent character', () => {
    let s = postMulliganInMain();
    s = addChar(s, 0, { instanceId: 'atk', cardId: 'TEST-CHAR-DOUBLEATTACK' }); // power 6000
    s = addChar(s, 1, { instanceId: 'victim', cardId: 'TEST-CHAR-ONKO-BANISH', rested: true });
    s = addChar(s, 1, { instanceId: 'collateral', cardId: 'TEST-CHAR-BASIC-01' });
    const s2 = apply(s, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Character', instanceId: 'atk' },
      target: { kind: 'Character', instanceId: 'victim', owner: 1 },
    }).state;
    const res = apply(s2, { kind: 'DeclineCounter', player: 1 });
    expect(res.error).toBeUndefined();
    // victim KO'd → goes to p1.trash. collateral untouched on p1.
    expect(res.state.players[1].trash).toContain('TEST-CHAR-ONKO-BANISH');
    expect(res.state.players[1].characters.map((c) => c.instanceId)).toEqual(['collateral']);
    // OnKO fires with sourcePlayer = KO'd character's owner (p1).
    // Effect `banish { opponentCharacter }` → from p1's perspective opponent = p0.
    // p0 only has 'atk' → 'atk' gets banished into p0.banishZone.
    expect(res.state.players[0].characters.length).toBe(0);
    expect(res.state.players[0].banishZone).toContain('TEST-CHAR-DOUBLEATTACK');
  });
});

describe('Blocker', () => {
  it('DeclineCounter opens BlockerStep when defender has usable blocker', () => {
    let s = postMulliganInMain();
    s = addChar(s, 1, { instanceId: 'blocker-1', cardId: 'TEST-CHAR-BLOCKER' });
    const s2 = apply(s, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Leader' },
      target: { kind: 'Leader' },
    }).state;
    const res = apply(s2, { kind: 'DeclineCounter', player: 1 });
    expect(res.error).toBeUndefined();
    const pw = res.state.priorityWindow;
    expect(pw?.kind).toBe('BlockerStep');
    if (pw?.kind === 'BlockerStep') {
      expect(pw.originalTarget.target.kind).toBe('Leader');
    }
  });

  it('UseBlocker redirects attack to the blocker character, which becomes rested', () => {
    let s = postMulliganInMain();
    s = addChar(s, 1, { instanceId: 'blocker-1', cardId: 'TEST-CHAR-BLOCKER' });
    const s2 = apply(s, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Leader' },
      target: { kind: 'Leader' },
    }).state;
    const s3 = apply(s2, { kind: 'DeclineCounter', player: 1 }).state;
    const res = apply(s3, {
      kind: 'UseBlocker',
      player: 1,
      blockerInstanceId: 'blocker-1',
    });
    expect(res.error).toBeUndefined();
    // Leader power 5000 vs Blocker 4000 → blocker KO'd
    expect(res.state.players[1].characters.length).toBe(0);
    expect(res.state.players[1].trash).toContain('TEST-CHAR-BLOCKER');
    // Leader life unchanged (redirected away)
    expect(res.state.players[1].life.length).toBe(4);
    expect(res.state.priorityWindow).toBeNull();
  });

  it('DeclineBlocker resolves with original target', () => {
    let s = postMulliganInMain();
    s = addChar(s, 1, { instanceId: 'blocker-1', cardId: 'TEST-CHAR-BLOCKER' });
    // Seed life with no triggers
    s = {
      ...s,
      players: [
        s.players[0],
        {
          ...s.players[1],
          life: [
            'TEST-CHAR-BASIC-01',
            'TEST-CHAR-BASIC-02',
            'TEST-CHAR-BASIC-01',
            'TEST-CHAR-BASIC-02',
          ],
        },
      ] as typeof s.players,
    };
    const s2 = apply(s, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Leader' },
      target: { kind: 'Leader' },
    }).state;
    const s3 = apply(s2, { kind: 'DeclineCounter', player: 1 }).state;
    const res = apply(s3, { kind: 'DeclineBlocker', player: 1 });
    expect(res.error).toBeUndefined();
    expect(res.state.players[1].life.length).toBe(3);
    expect(res.state.priorityWindow).toBeNull();
  });

  it('Blocker already used this turn is NOT offered', () => {
    let s = postMulliganInMain();
    s = addChar(s, 1, {
      instanceId: 'blocker-1',
      cardId: 'TEST-CHAR-BLOCKER',
      usedBlockerThisTurn: true,
    });
    const s2 = apply(s, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Leader' },
      target: { kind: 'Leader' },
    }).state;
    const res = apply(s2, { kind: 'DeclineCounter', player: 1 });
    expect(res.error).toBeUndefined();
    // No blocker step; resolved directly
    expect(res.state.priorityWindow).toBeNull();
  });

  it('Rested blocker is NOT offered', () => {
    let s = postMulliganInMain();
    s = addChar(s, 1, {
      instanceId: 'blocker-1',
      cardId: 'TEST-CHAR-BLOCKER',
      rested: true,
    });
    const s2 = apply(s, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Leader' },
      target: { kind: 'Leader' },
    }).state;
    const res = apply(s2, { kind: 'DeclineCounter', player: 1 });
    expect(res.error).toBeUndefined();
    expect(res.state.priorityWindow).toBeNull();
  });

  it('UseBlocker with non-blocker character errors', () => {
    let s = postMulliganInMain();
    s = addChar(s, 1, { instanceId: 'not-blocker', cardId: 'TEST-CHAR-BLOCKER' });
    const s2 = apply(s, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Leader' },
      target: { kind: 'Leader' },
    }).state;
    const s3 = apply(s2, { kind: 'DeclineCounter', player: 1 }).state;
    const res = apply(s3, {
      kind: 'UseBlocker',
      player: 1,
      blockerInstanceId: 'wrong-id',
    });
    expect(res.error).toBeDefined();
  });
});
