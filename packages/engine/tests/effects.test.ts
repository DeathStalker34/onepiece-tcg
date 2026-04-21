import { describe, expect, it } from 'vitest';
import { applyEffect, type EffectContext } from '../src/effects/executor';
import { createInitialState } from '../src/setup';
import type { GameState, MatchSetup } from '../src/types/state';
import type { Effect } from '../src/types/card';
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

function mkContext(_state: GameState): EffectContext {
  return { sourcePlayer: 0, sourceCardId: 'TEST-LEADER-01' };
}

describe('applyEffect — draw', () => {
  it('moves N cards from deck to hand', () => {
    const s = createInitialState(mkSetup());
    const handBefore = s.players[0].hand.length;
    const deckBefore = s.players[0].deck.length;
    const { state } = applyEffect(s, { kind: 'draw', amount: 2 }, mkContext(s));
    expect(state.players[0].hand.length).toBe(handBefore + 2);
    expect(state.players[0].deck.length).toBe(deckBefore - 2);
  });

  it('draws 0 if deck empty', () => {
    let s = createInitialState(mkSetup());
    s = {
      ...s,
      players: [{ ...s.players[0], deck: [] }, s.players[1]] as typeof s.players,
    };
    const { state } = applyEffect(s, { kind: 'draw', amount: 2 }, mkContext(s));
    expect(state.players[0].deck.length).toBe(0);
  });
});

describe('applyEffect — ko', () => {
  it('removes an opponent character to trash', () => {
    let s = createInitialState(mkSetup());
    s = {
      ...s,
      players: [
        s.players[0],
        {
          ...s.players[1],
          characters: [
            {
              instanceId: 'v',
              cardId: 'TEST-CHAR-BASIC-01',
              rested: false,
              attachedDon: 0,
              powerThisTurn: 0,
              summoningSickness: false,
              usedBlockerThisTurn: false,
            },
          ],
        },
      ] as typeof s.players,
    };
    const eff: Effect = { kind: 'ko', target: { kind: 'opponentCharacter' } };
    const { state } = applyEffect(s, eff, { sourcePlayer: 0, sourceCardId: 'X' });
    expect(state.players[1].characters.length).toBe(0);
    expect(state.players[1].trash).toContain('TEST-CHAR-BASIC-01');
  });

  it('no target → no-op', () => {
    const s = createInitialState(mkSetup());
    const eff: Effect = { kind: 'ko', target: { kind: 'opponentCharacter' } };
    const { state } = applyEffect(s, eff, { sourcePlayer: 0, sourceCardId: 'X' });
    expect(state).toEqual(s);
  });
});

describe('applyEffect — power', () => {
  it('adds delta to target leader powerThisTurn (self)', () => {
    const s = createInitialState(mkSetup());
    const eff: Effect = {
      kind: 'power',
      target: { kind: 'self' },
      delta: 1500,
      duration: 'thisTurn',
    };
    const { state } = applyEffect(s, eff, { sourcePlayer: 0, sourceCardId: 'X' });
    expect(state.players[0].leader.powerThisTurn).toBe(1500);
  });
});

describe('applyEffect — banish', () => {
  it('moves opponent character to banishZone', () => {
    let s = createInitialState(mkSetup());
    s = {
      ...s,
      players: [
        s.players[0],
        {
          ...s.players[1],
          characters: [
            {
              instanceId: 'v',
              cardId: 'TEST-CHAR-BASIC-01',
              rested: false,
              attachedDon: 0,
              powerThisTurn: 0,
              summoningSickness: false,
              usedBlockerThisTurn: false,
            },
          ],
        },
      ] as typeof s.players,
    };
    const eff: Effect = { kind: 'banish', target: { kind: 'opponentCharacter' } };
    const { state } = applyEffect(s, eff, { sourcePlayer: 0, sourceCardId: 'X' });
    expect(state.players[1].characters.length).toBe(0);
    expect(state.players[1].banishZone).toContain('TEST-CHAR-BASIC-01');
    expect(state.players[1].trash).not.toContain('TEST-CHAR-BASIC-01');
  });
});

describe('applyEffect — returnToHand', () => {
  it('returns opponent character from play to hand', () => {
    let s = createInitialState(mkSetup());
    s = {
      ...s,
      players: [
        s.players[0],
        {
          ...s.players[1],
          characters: [
            {
              instanceId: 'v',
              cardId: 'TEST-CHAR-BASIC-01',
              rested: false,
              attachedDon: 0,
              powerThisTurn: 0,
              summoningSickness: false,
              usedBlockerThisTurn: false,
            },
          ],
        },
      ] as typeof s.players,
    };
    const eff: Effect = { kind: 'returnToHand', target: { kind: 'opponentCharacter' } };
    const { state } = applyEffect(s, eff, { sourcePlayer: 0, sourceCardId: 'X' });
    expect(state.players[1].characters.length).toBe(0);
    expect(state.players[1].hand).toContain('TEST-CHAR-BASIC-01');
  });
});

describe('applyEffect — search', () => {
  it('picks first matching card from deck into hand', () => {
    const s = createInitialState(mkSetup());
    const eff: Effect = {
      kind: 'search',
      from: 'deck',
      filter: { type: 'CHARACTER' },
      amount: 1,
    };
    const handBefore = s.players[0].hand.length;
    const { state } = applyEffect(s, eff, { sourcePlayer: 0, sourceCardId: 'X' });
    expect(state.players[0].hand.length).toBe(handBefore + 1);
  });
});

describe('applyEffect — sequence', () => {
  it('applies steps in order', () => {
    const s = createInitialState(mkSetup());
    const eff: Effect = {
      kind: 'sequence',
      steps: [
        { kind: 'draw', amount: 1 },
        { kind: 'draw', amount: 2 },
      ],
    };
    const handBefore = s.players[0].hand.length;
    const { state } = applyEffect(s, eff, { sourcePlayer: 0, sourceCardId: 'X' });
    expect(state.players[0].hand.length).toBe(handBefore + 3);
  });
});

describe('applyEffect — choice', () => {
  it('defaults to options[0]', () => {
    const s = createInitialState(mkSetup());
    const eff: Effect = {
      kind: 'choice',
      options: [
        { kind: 'draw', amount: 1 },
        { kind: 'draw', amount: 999 },
      ],
    };
    const handBefore = s.players[0].hand.length;
    const { state } = applyEffect(s, eff, { sourcePlayer: 0, sourceCardId: 'X' });
    expect(state.players[0].hand.length).toBe(handBefore + 1);
  });
});

describe('applyEffect — manual', () => {
  it('is a no-op (emits event only)', () => {
    const s = createInitialState(mkSetup());
    const eff: Effect = { kind: 'manual', text: 'Do X manually' };
    const { state, events } = applyEffect(s, eff, { sourcePlayer: 0, sourceCardId: 'X' });
    expect(state).toEqual(s);
    expect(events.some((e) => e.kind === 'EffectResolved')).toBe(true);
  });
});
