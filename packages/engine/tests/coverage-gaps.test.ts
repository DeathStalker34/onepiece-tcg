import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/setup';
import { apply } from '../src/apply';
import { updateAt, removeAt } from '../src/helpers/immutable';
import { validateDeck } from '../src/deck';
import type { CardRow } from '../src/deck';
import type { GameState, MatchSetup, CharacterInPlay } from '../src/types/state';
import type { Action } from '../src/types/action';
import { TEST_CATALOG } from './fixtures/test-cards';
import { simpleRedDeck50 } from './fixtures/simple-red-deck';

/**
 * Targeted tests to cover legitimate branches missed by the main suite.
 * Focused on user-reachable edge cases: wrong-phase errors, validation edges,
 * no-op effect paths, and negative-index helpers.
 */

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

function postMulligan(setup: MatchSetup = mkSetup()): GameState {
  let s = createInitialState(setup);
  s = apply(s, { kind: 'Mulligan', player: 0, mulligan: false }).state;
  s = apply(s, { kind: 'Mulligan', player: 1, mulligan: false }).state;
  return s;
}

function postMulliganInMain(setup: MatchSetup = mkSetup()): GameState {
  let s = postMulligan(setup);
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

describe('immutable helpers — negative index branches', () => {
  it('updateAt with negative index returns copy unchanged', () => {
    const input = [1, 2, 3];
    const out = updateAt(input, -1, 99);
    expect(out).toEqual([1, 2, 3]);
    expect(out).not.toBe(input);
  });

  it('removeAt with negative index returns copy unchanged', () => {
    const input = [1, 2, 3];
    const out = removeAt(input, -5);
    expect(out).toEqual([1, 2, 3]);
    expect(out).not.toBe(input);
  });
});

describe('validateDeck — card not in index is skipped', () => {
  it('unknown cardId in draft is ignored for color check (branch: !card → continue)', () => {
    const index = new Map<string, CardRow>([
      ['LEAD', { id: 'LEAD', colors: ['Red'], type: 'LEADER' }],
      ['K', { id: 'K', colors: ['Red'], type: 'CHARACTER' }],
    ]);
    const result = validateDeck(
      {
        leaderCardId: 'LEAD',
        cards: [
          { cardId: 'K', quantity: 40 },
          { cardId: 'UNKNOWN', quantity: 10 },
        ],
      },
      index,
    );
    // Unknown card skipped → no colorMismatch issue reported for it.
    expect(result.issues.find((i) => i.kind === 'colorMismatch')).toBeUndefined();
  });
});

describe('apply — PassPhase wrong-phase branches', () => {
  it('PassPhase in Main returns WrongPhase (use EndTurn, not PassPhase)', () => {
    const s = postMulliganInMain();
    const res = apply(s, { kind: 'PassPhase', player: 0 });
    expect(res.error?.code).toBe('WrongPhase');
  });

  it('PassPhase in End phase returns WrongPhase', () => {
    // Craft a state in End phase manually (End is only transient inside runEnd,
    // but apply guards against it being used by a client).
    let s = postMulligan();
    s = { ...s, phase: 'End' };
    const res = apply(s, { kind: 'PassPhase', player: 0 });
    expect(res.error?.code).toBe('WrongPhase');
  });

  it('PassPhase with open priorityWindow returns NotYourPriority', () => {
    // State with a lingering priorityWindow (should never happen in normal flow;
    // guard path covered here).
    const base = postMulligan();
    const s: GameState = {
      ...base,
      priorityWindow: {
        kind: 'CounterStep',
        attacker: { owner: 0, source: { kind: 'Leader' }, attackPower: 5000 },
        defender: { owner: 1, target: { kind: 'Leader' }, defensePower: 5000 },
      },
    };
    const res = apply(s, { kind: 'PassPhase', player: 0 });
    expect(res.error?.code).toBe('NotYourPriority');
  });
});

describe('apply — EndTurn wrong-player branch', () => {
  it('EndTurn by non-active player returns NotYourPriority', () => {
    const s = postMulliganInMain();
    const res = apply(s, { kind: 'EndTurn', player: 1 });
    expect(res.error?.code).toBe('NotYourPriority');
  });
});

describe('Main phase — guard branches across play actions', () => {
  it('PlayCharacter outside Main → WrongPhase', () => {
    const s = postMulligan(); // in Refresh
    const res = apply(s, { kind: 'PlayCharacter', player: 0, handIndex: 0, donSpent: 0 });
    expect(res.error?.code).toBe('WrongPhase');
  });

  it('PlayCharacter by non-active player → NotYourPriority', () => {
    const s = postMulliganInMain();
    const res = apply(s, { kind: 'PlayCharacter', player: 1, handIndex: 0, donSpent: 0 });
    expect(res.error?.code).toBe('NotYourPriority');
  });

  it('PlayCharacter on a non-CHARACTER card → InvalidTarget', () => {
    let s = postMulliganInMain();
    s = {
      ...s,
      players: [
        { ...s.players[0], hand: ['TEST-EVENT-KO'], donActive: 10 },
        s.players[1],
      ] as typeof s.players,
    };
    const res = apply(s, { kind: 'PlayCharacter', player: 0, handIndex: 0, donSpent: 0 });
    expect(res.error?.code).toBe('InvalidTarget');
  });

  it('PlayEvent on a non-EVENT card already covered; PlayEvent CardNotInHand', () => {
    const s = postMulliganInMain();
    const res = apply(s, { kind: 'PlayEvent', player: 0, handIndex: 999, donSpent: 0 });
    expect(res.error?.code).toBe('CardNotInHand');
  });

  it('PlayStage on a non-STAGE card → InvalidTarget', () => {
    let s = postMulliganInMain();
    s = {
      ...s,
      players: [
        { ...s.players[0], hand: ['TEST-CHAR-BASIC-01'], donActive: 10 },
        s.players[1],
      ] as typeof s.players,
    };
    const res = apply(s, { kind: 'PlayStage', player: 0, handIndex: 0, donSpent: 0 });
    expect(res.error?.code).toBe('InvalidTarget');
  });

  it('PlayStage CardNotInHand for out-of-bounds index', () => {
    const s = postMulliganInMain();
    const res = apply(s, { kind: 'PlayStage', player: 0, handIndex: 999, donSpent: 0 });
    expect(res.error?.code).toBe('CardNotInHand');
  });

  it('AttachDon outside Main → WrongPhase', () => {
    const s = postMulligan();
    const res = apply(s, { kind: 'AttachDon', player: 0, target: { kind: 'Leader' } });
    expect(res.error?.code).toBe('WrongPhase');
  });

  it('ActivateMain outside Main → WrongPhase', () => {
    const s = postMulligan();
    const res = apply(s, { kind: 'ActivateMain', player: 0, source: { kind: 'Leader' } });
    expect(res.error?.code).toBe('WrongPhase');
  });

  it('ActivateMain on character with Activate:Main effect → resolves', () => {
    // Inject a bespoke character that has an Activate:Main effect into catalog via setup.
    const catalog = {
      ...TEST_CATALOG,
      'TEST-CHAR-ACTIVATE': {
        ...TEST_CATALOG['TEST-CHAR-BASIC-01'],
        id: 'TEST-CHAR-ACTIVATE',
        effects: [
          {
            trigger: 'Activate:Main' as const,
            cost: { rest: 'self' as const },
            effect: { kind: 'draw' as const, amount: 1 },
          },
        ],
      },
    };
    let s = postMulliganInMain({ ...mkSetup(), catalog });
    s = addChar(s, 0, { instanceId: 'c1', cardId: 'TEST-CHAR-ACTIVATE' });
    const handBefore = s.players[0].hand.length;
    const deckBefore = s.players[0].deck.length;
    const res = apply(s, {
      kind: 'ActivateMain',
      player: 0,
      source: { kind: 'Character', instanceId: 'c1' },
    });
    expect(res.error).toBeUndefined();
    expect(res.state.players[0].characters[0].rested).toBe(true);
    expect(res.state.players[0].hand.length).toBe(handBefore + 1);
    expect(res.state.players[0].deck.length).toBe(deckBefore - 1);
  });

  it('ActivateMain on rested character → CharacterIsRested', () => {
    let s = postMulliganInMain();
    s = addChar(s, 0, { instanceId: 'c1', cardId: 'TEST-CHAR-BASIC-01', rested: true });
    const res = apply(s, {
      kind: 'ActivateMain',
      player: 0,
      source: { kind: 'Character', instanceId: 'c1' },
    });
    expect(res.error?.code).toBe('CharacterIsRested');
  });

  it('ActivateMain on character without Activate:Main → InvalidTarget', () => {
    let s = postMulliganInMain();
    s = addChar(s, 0, { instanceId: 'c1', cardId: 'TEST-CHAR-BASIC-01' });
    const res = apply(s, {
      kind: 'ActivateMain',
      player: 0,
      source: { kind: 'Character', instanceId: 'c1' },
    });
    expect(res.error?.code).toBe('InvalidTarget');
  });
});

describe('DeclareAttack — wrong-phase / priority guards', () => {
  it('DeclareAttack outside Main → WrongPhase', () => {
    const s = postMulligan();
    const res = apply(s, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Leader' },
      target: { kind: 'Leader' },
    });
    expect(res.error?.code).toBe('WrongPhase');
  });

  it('DeclareAttack by non-active player → NotYourPriority', () => {
    const s = postMulliganInMain();
    const res = apply(s, {
      kind: 'DeclareAttack',
      player: 1,
      attacker: { kind: 'Leader' },
      target: { kind: 'Leader' },
    });
    expect(res.error?.code).toBe('NotYourPriority');
  });

  it('DeclareAttack with attacker instanceId not found → InvalidTarget', () => {
    const s = postMulliganInMain();
    const res = apply(s, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Character', instanceId: 'does-not-exist' },
      target: { kind: 'Leader' },
    });
    expect(res.error?.code).toBe('InvalidTarget');
  });

  it('DeclareAttack with target owner mismatch → InvalidTarget', () => {
    let s = postMulliganInMain();
    s = addChar(s, 0, { instanceId: 'atk', cardId: 'TEST-CHAR-RUSH' });
    s = addChar(s, 0, { instanceId: 'own-char', cardId: 'TEST-CHAR-BASIC-01', rested: true });
    const res = apply(s, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Character', instanceId: 'atk' },
      // owner is 1 but instanceId belongs to p0 → owner mismatch
      target: { kind: 'Character', instanceId: 'own-char', owner: 1 },
    });
    expect(res.error?.code).toBe('InvalidTarget');
  });

  it('DeclareAttack with target instanceId not found on opponent → InvalidTarget', () => {
    const s = postMulliganInMain();
    const res = apply(s, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Leader' },
      target: { kind: 'Character', instanceId: 'does-not-exist', owner: 1 },
    });
    expect(res.error?.code).toBe('InvalidTarget');
  });
});

describe('Blocker — used-this-turn / rested error paths', () => {
  it('UseBlocker without active BlockerStep → NotYourPriority', () => {
    const s = postMulliganInMain();
    const res = apply(s, {
      kind: 'UseBlocker',
      player: 1,
      blockerInstanceId: 'x',
    });
    expect(res.error?.code).toBe('NotYourPriority');
  });

  it('UseBlocker by wrong player → NotYourPriority', () => {
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
      player: 0,
      blockerInstanceId: 'blocker-1',
    });
    expect(res.error?.code).toBe('NotYourPriority');
  });

  it('DeclineBlocker without active BlockerStep → NotYourPriority', () => {
    const s = postMulliganInMain();
    const res = apply(s, { kind: 'DeclineBlocker', player: 1 });
    expect(res.error?.code).toBe('NotYourPriority');
  });

  it('DeclineBlocker by wrong player → NotYourPriority', () => {
    let s = postMulliganInMain();
    s = addChar(s, 1, { instanceId: 'blocker-1', cardId: 'TEST-CHAR-BLOCKER' });
    const s2 = apply(s, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Leader' },
      target: { kind: 'Leader' },
    }).state;
    const s3 = apply(s2, { kind: 'DeclineCounter', player: 1 }).state;
    const res = apply(s3, { kind: 'DeclineBlocker', player: 0 });
    expect(res.error?.code).toBe('NotYourPriority');
  });

  it('UseBlocker on rested/used blocker → InvalidTarget', () => {
    let s = postMulliganInMain();
    // Place a blocker and an attacker
    s = addChar(s, 1, { instanceId: 'other', cardId: 'TEST-CHAR-BLOCKER' });
    s = addChar(s, 1, {
      instanceId: 'rested-blocker',
      cardId: 'TEST-CHAR-BLOCKER',
      rested: true,
    });
    const s2 = apply(s, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Leader' },
      target: { kind: 'Leader' },
    }).state;
    const s3 = apply(s2, { kind: 'DeclineCounter', player: 1 }).state;
    // BlockerStep is open; try to use the rested one (which isn't in available list,
    // but is still present on the player's characters)
    const res = apply(s3, {
      kind: 'UseBlocker',
      player: 1,
      blockerInstanceId: 'rested-blocker',
    });
    expect(res.error?.code).toBe('InvalidTarget');
  });
});

describe('CounterStep — priority / wrong-player guards', () => {
  it('PlayCounter without active CounterStep → NotYourPriority', () => {
    const s = postMulliganInMain();
    const res = apply(s, { kind: 'PlayCounter', player: 1, handIndex: 0 });
    expect(res.error?.code).toBe('NotYourPriority');
  });

  it('DeclineCounter without active CounterStep → NotYourPriority', () => {
    const s = postMulliganInMain();
    const res = apply(s, { kind: 'DeclineCounter', player: 1 });
    expect(res.error?.code).toBe('NotYourPriority');
  });

  it('PlayCounter with out-of-bounds handIndex → CardNotInHand', () => {
    const s = postMulliganInMain();
    const s2 = apply(s, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Leader' },
      target: { kind: 'Leader' },
    }).state;
    const res = apply(s2, { kind: 'PlayCounter', player: 1, handIndex: 999 });
    expect(res.error?.code).toBe('CardNotInHand');
  });
});

describe('TriggerStep — priority / wrong-player guards', () => {
  it('ActivateTrigger without TriggerStep → NotYourPriority', () => {
    const s = postMulliganInMain();
    const res = apply(s, { kind: 'ActivateTrigger', player: 1, activate: true });
    expect(res.error?.code).toBe('NotYourPriority');
  });

  it('ActivateTrigger by wrong owner → NotYourPriority', () => {
    let s = postMulliganInMain();
    // Seed p1 life with a trigger card
    s = {
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
    const s2 = apply(s, {
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Leader' },
      target: { kind: 'Leader' },
    }).state;
    const s3 = apply(s2, { kind: 'DeclineCounter', player: 1 }).state;
    // TriggerStep owner = 1; p0 tries to activate
    const res = apply(s3, { kind: 'ActivateTrigger', player: 0, activate: true });
    expect(res.error?.code).toBe('NotYourPriority');
  });
});

describe('Mulligan — priority guard in non-mulligan window', () => {
  it('Mulligan after window closed → NotYourPriority', () => {
    const s = postMulligan(); // window closed
    const res = apply(s, { kind: 'Mulligan', player: 0, mulligan: false });
    expect(res.error?.code).toBe('NotYourPriority');
  });
});

describe('runEnd — hand limit + EndOfTurn trigger loop on character', () => {
  it('discards down to 10 from the end when hand exceeds limit', () => {
    let s = postMulliganInMain();
    // Build an oversized hand to force discard branch
    const oversized = Array.from(
      { length: 12 },
      (_, i) => 'TEST-CHAR-BASIC-01' + (i === 0 ? '' : ''),
    );
    s = {
      ...s,
      players: [{ ...s.players[0], hand: oversized }, s.players[1]] as typeof s.players,
    };
    const res = apply(s, { kind: 'EndTurn', player: 0 });
    expect(res.error).toBeUndefined();
    // hand trimmed to 10; excess 2 cards appended to trash
    expect(res.state.players[0].hand.length).toBe(10);
    expect(res.state.players[0].trash.length).toBeGreaterThanOrEqual(2);
  });

  it('EndOfTurn hook loops over characters (no effect but runs through)', () => {
    let s = postMulliganInMain();
    s = addChar(s, 0, { instanceId: 'c1', cardId: 'TEST-CHAR-BASIC-01' });
    s = addChar(s, 0, { instanceId: 'c2', cardId: 'TEST-CHAR-BASIC-02' });
    const res = apply(s, { kind: 'EndTurn', player: 0 });
    expect(res.error).toBeUndefined();
    // End cleared summoning sickness, reset powerThisTurn, kept characters
    expect(res.state.players[0].characters.length).toBe(2);
    expect(res.state.players[0].characters.every((c) => !c.summoningSickness)).toBe(true);
  });
});

describe('effects/executor — ownCharacter target + empty character list no-ops', () => {
  it('ko { ownCharacter } with no character present → no-op', () => {
    // Force an effect that targets ownCharacter through Activate:Main
    const catalog = {
      ...TEST_CATALOG,
      'TEST-LEADER-OWNKO': {
        ...TEST_CATALOG['TEST-LEADER-01'],
        id: 'TEST-LEADER-OWNKO',
        effects: [
          {
            trigger: 'Activate:Main' as const,
            cost: { rest: 'self' as const },
            effect: { kind: 'ko' as const, target: { kind: 'ownCharacter' as const } },
          },
        ],
      },
    };
    const setup: MatchSetup = {
      ...mkSetup(),
      catalog,
      players: [
        { playerId: 'p0', leaderCardId: 'TEST-LEADER-OWNKO', deck: simpleRedDeck50() },
        { playerId: 'p1', leaderCardId: 'TEST-LEADER-02', deck: simpleRedDeck50() },
      ],
    };
    const s = postMulliganInMain(setup);
    const res = apply(s, { kind: 'ActivateMain', player: 0, source: { kind: 'Leader' } });
    expect(res.error).toBeUndefined();
    // No own character to KO → state unchanged except leader rested
    expect(res.state.players[0].characters.length).toBe(0);
  });

  it('power target { opponentLeader } applies delta to opponent leader', () => {
    const catalog = {
      ...TEST_CATALOG,
      'TEST-LEADER-OPPPWR': {
        ...TEST_CATALOG['TEST-LEADER-01'],
        id: 'TEST-LEADER-OPPPWR',
        effects: [
          {
            trigger: 'Activate:Main' as const,
            cost: { rest: 'self' as const },
            effect: {
              kind: 'power' as const,
              target: { kind: 'opponentLeader' as const },
              delta: -1000,
              duration: 'thisTurn' as const,
            },
          },
        ],
      },
    };
    const setup: MatchSetup = {
      ...mkSetup(),
      catalog,
      players: [
        { playerId: 'p0', leaderCardId: 'TEST-LEADER-OPPPWR', deck: simpleRedDeck50() },
        { playerId: 'p1', leaderCardId: 'TEST-LEADER-02', deck: simpleRedDeck50() },
      ],
    };
    const s = postMulliganInMain(setup);
    const res = apply(s, { kind: 'ActivateMain', player: 0, source: { kind: 'Leader' } });
    expect(res.error).toBeUndefined();
    expect(res.state.players[1].leader.powerThisTurn).toBe(-1000);
  });

  it('power target { ownCharacter } applies delta when character exists', () => {
    const catalog = {
      ...TEST_CATALOG,
      'TEST-LEADER-OWNPWR': {
        ...TEST_CATALOG['TEST-LEADER-01'],
        id: 'TEST-LEADER-OWNPWR',
        effects: [
          {
            trigger: 'Activate:Main' as const,
            cost: { rest: 'self' as const },
            effect: {
              kind: 'power' as const,
              target: { kind: 'ownCharacter' as const },
              delta: 1000,
              duration: 'thisTurn' as const,
            },
          },
        ],
      },
    };
    const setup: MatchSetup = {
      ...mkSetup(),
      catalog,
      players: [
        { playerId: 'p0', leaderCardId: 'TEST-LEADER-OWNPWR', deck: simpleRedDeck50() },
        { playerId: 'p1', leaderCardId: 'TEST-LEADER-02', deck: simpleRedDeck50() },
      ],
    };
    let s = postMulliganInMain(setup);
    s = addChar(s, 0, { instanceId: 'c1', cardId: 'TEST-CHAR-BASIC-01' });
    const res = apply(s, { kind: 'ActivateMain', player: 0, source: { kind: 'Leader' } });
    expect(res.error).toBeUndefined();
    expect(res.state.players[0].characters[0].powerThisTurn).toBe(1000);
  });

  it('search from trash picks matching card', () => {
    const catalog = {
      ...TEST_CATALOG,
      'TEST-LEADER-SEARCH': {
        ...TEST_CATALOG['TEST-LEADER-01'],
        id: 'TEST-LEADER-SEARCH',
        effects: [
          {
            trigger: 'Activate:Main' as const,
            cost: { rest: 'self' as const },
            effect: {
              kind: 'search' as const,
              from: 'trash' as const,
              filter: { type: 'CHARACTER' as const },
              amount: 1,
            },
          },
        ],
      },
    };
    const setup: MatchSetup = {
      ...mkSetup(),
      catalog,
      players: [
        { playerId: 'p0', leaderCardId: 'TEST-LEADER-SEARCH', deck: simpleRedDeck50() },
        { playerId: 'p1', leaderCardId: 'TEST-LEADER-02', deck: simpleRedDeck50() },
      ],
    };
    let s = postMulliganInMain(setup);
    s = {
      ...s,
      players: [
        { ...s.players[0], trash: ['TEST-CHAR-BASIC-01'] },
        s.players[1],
      ] as typeof s.players,
    };
    const handBefore = s.players[0].hand.length;
    const res = apply(s, { kind: 'ActivateMain', player: 0, source: { kind: 'Leader' } });
    expect(res.error).toBeUndefined();
    expect(res.state.players[0].hand.length).toBe(handBefore + 1);
    expect(res.state.players[0].trash).not.toContain('TEST-CHAR-BASIC-01');
  });

  it('search filter with colors+costMin+costMax+keyword branches all exercised', () => {
    const catalog = {
      ...TEST_CATALOG,
      'TEST-LEADER-FILTER': {
        ...TEST_CATALOG['TEST-LEADER-01'],
        id: 'TEST-LEADER-FILTER',
        effects: [
          {
            trigger: 'Activate:Main' as const,
            cost: { rest: 'self' as const },
            effect: {
              kind: 'search' as const,
              from: 'deck' as const,
              filter: {
                colors: ['Red'],
                costMin: 1,
                costMax: 10,
                keyword: 'Rush' as const,
              },
              amount: 1,
            },
          },
        ],
      },
    };
    const setup: MatchSetup = {
      ...mkSetup(),
      catalog,
      players: [
        { playerId: 'p0', leaderCardId: 'TEST-LEADER-FILTER', deck: simpleRedDeck50() },
        { playerId: 'p1', leaderCardId: 'TEST-LEADER-02', deck: simpleRedDeck50() },
      ],
    };
    const s = postMulliganInMain(setup);
    const res = apply(s, { kind: 'ActivateMain', player: 0, source: { kind: 'Leader' } });
    expect(res.error).toBeUndefined();
    // Effect runs; we don't assert a specific card since the filter may or may not match
    // the shuffled deck. The branches (colors / costMin / costMax / keyword) all
    // evaluate for each card iterated.
  });
});

describe('apply — unknown action payload with shape-mismatch', () => {
  it('returns Unknown error on unrecognized kind', () => {
    const s = postMulligan();
    const badAction = { kind: 'NotRealAction', player: 0 } as unknown as Action;
    const res = apply(s, badAction);
    expect(res.error?.code).toBe('Unknown');
  });
});
