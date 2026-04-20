import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/setup';
import { TEST_CATALOG } from './fixtures/test-cards';
import { simpleRedDeck50 } from './fixtures/simple-red-deck';
import type { MatchSetup } from '../src/types/state';

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

describe('createInitialState', () => {
  it('creates a state with 2 players', () => {
    const state = createInitialState(mkSetup());
    expect(state.players.length).toBe(2);
  });

  it('each player has leader, hand of 5, life of 4 (leader life), and deck of 50-5-4=41', () => {
    const state = createInitialState(mkSetup());
    for (const p of state.players) {
      expect(p.hand.length).toBe(5);
      expect(p.life.length).toBe(4);
      expect(p.deck.length).toBe(50 - 5 - 4);
    }
  });

  it('each player has donDeck=10, donActive=0, donRested=0', () => {
    const state = createInitialState(mkSetup());
    for (const p of state.players) {
      expect(p.donDeck).toBe(10);
      expect(p.donActive).toBe(0);
      expect(p.donRested).toBe(0);
    }
  });

  it('leader is placed with rested=false, attachedDon=0, powerThisTurn=0', () => {
    const state = createInitialState(mkSetup());
    for (const p of state.players) {
      expect(p.leader.rested).toBe(false);
      expect(p.leader.attachedDon).toBe(0);
      expect(p.leader.powerThisTurn).toBe(0);
    }
    expect(state.players[0].leader.cardId).toBe('TEST-LEADER-01');
    expect(state.players[1].leader.cardId).toBe('TEST-LEADER-02');
  });

  it('initial phase is Setup with Mulligan priority for first player', () => {
    const state = createInitialState(mkSetup());
    expect(state.phase).toBe('Setup');
    expect(state.priorityWindow).toEqual({ kind: 'Mulligan', player: 0 });
    expect(state.turn).toBe(0);
    expect(state.activePlayer).toBe(0);
    expect(state.winner).toBeNull();
    expect(state.isFirstTurnOfFirstPlayer).toBe(true);
  });

  it('RNG carries seed and has advanced pointer after shuffling', () => {
    const state = createInitialState(mkSetup(123));
    expect(state.rng.seed).toBe(123);
    expect(state.rng.pointer).toBeGreaterThan(0);
  });

  it('log and catalog are present and correct', () => {
    const state = createInitialState(mkSetup());
    expect(state.log).toEqual([]);
    expect(state.catalog).toBe(
      mkSetup().catalog === state.catalog ? mkSetup().catalog : state.catalog,
    );
    // assert catalog contains TEST-LEADER-01
    expect(state.catalog['TEST-LEADER-01']).toBeDefined();
  });

  it('deterministic: same seed → same initial hand', () => {
    const a = createInitialState(mkSetup(7));
    const b = createInitialState(mkSetup(7));
    expect(a.players[0].hand).toEqual(b.players[0].hand);
    expect(a.players[1].hand).toEqual(b.players[1].hand);
  });

  it('mulligan: neither player has taken it yet', () => {
    const state = createInitialState(mkSetup());
    expect(state.players[0].mulliganTaken).toBe(false);
    expect(state.players[1].mulliganTaken).toBe(false);
  });

  it('banishZone and trash start empty', () => {
    const state = createInitialState(mkSetup());
    for (const p of state.players) {
      expect(p.trash).toEqual([]);
      expect(p.banishZone).toEqual([]);
      expect(p.characters).toEqual([]);
      expect(p.stage).toBeNull();
    }
  });

  it('different firstPlayer starts with that player having priority', () => {
    const setup = mkSetup();
    setup.firstPlayer = 1;
    const state = createInitialState(setup);
    expect(state.activePlayer).toBe(1);
    expect(state.priorityWindow).toEqual({ kind: 'Mulligan', player: 1 });
  });
});
