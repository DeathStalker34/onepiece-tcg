import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/setup';
import { apply } from '../src/apply';
import type { Action } from '../src/types/action';
import type { GameState, MatchSetup } from '../src/types/state';
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

function postMulligan(setup: MatchSetup = mkSetup()): GameState {
  let s = createInitialState(setup);
  s = apply(s, { kind: 'Mulligan', player: 0, mulligan: false }).state;
  s = apply(s, { kind: 'Mulligan', player: 1, mulligan: false }).state;
  return s;
}

describe('Mulligan flow', () => {
  it('declining mulligan as first player moves priority to second player', () => {
    const s0 = createInitialState(mkSetup());
    const res = apply(s0, { kind: 'Mulligan', player: 0, mulligan: false });
    expect(res.error).toBeUndefined();
    expect(res.state.priorityWindow).toEqual({ kind: 'Mulligan', player: 1 });
    expect(res.state.players[0].mulliganTaken).toBe(true);
  });

  it('after both decline, phase transitions to Refresh', () => {
    const s0 = createInitialState(mkSetup());
    const s1 = apply(s0, { kind: 'Mulligan', player: 0, mulligan: false }).state;
    const s2 = apply(s1, { kind: 'Mulligan', player: 1, mulligan: false }).state;
    expect(s2.priorityWindow).toBeNull();
    expect(s2.phase).toBe('Refresh');
    expect(s2.activePlayer).toBe(0);
  });

  it('taking mulligan shuffles 5 cards back and draws new 5', () => {
    const s0 = createInitialState(mkSetup(100));
    const res = apply(s0, { kind: 'Mulligan', player: 0, mulligan: true });
    expect(res.state.players[0].hand.length).toBe(5);
    const deckAfter = res.state.players[0].deck;
    const lifeAfter = res.state.players[0].life;
    // Hand was 5, deck was 50-4-5=41, life=4 → total 50 cards conserved among hand+deck+life
    expect(res.state.players[0].hand.length + deckAfter.length + lifeAfter.length).toBe(50);
    expect(res.state.players[0].mulliganTaken).toBe(true);
  });

  it('wrong player trying mulligan errors with NotYourPriority', () => {
    const s0 = createInitialState(mkSetup());
    const res = apply(s0, { kind: 'Mulligan', player: 1, mulligan: false });
    expect(res.error).toEqual({ code: 'NotYourPriority' });
    expect(res.state).toBe(s0);
  });

  it('logs actions on success', () => {
    const s0 = createInitialState(mkSetup());
    const res = apply(s0, { kind: 'Mulligan', player: 0, mulligan: false });
    expect(res.state.log.length).toBe(1);
    expect(res.state.log[0]).toEqual({ kind: 'Mulligan', player: 0, mulligan: false });
  });

  it('does not log on error', () => {
    const s0 = createInitialState(mkSetup());
    const res = apply(s0, { kind: 'Mulligan', player: 1, mulligan: false });
    expect(res.error).toBeDefined();
    expect(res.state.log.length).toBe(0);
  });
});

describe('Phase transitions (after mulligan)', () => {
  it('PassPhase Refresh → Draw (skipped on first turn of first player) → Don → Main', () => {
    let s = postMulligan();
    expect(s.phase).toBe('Refresh');
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    expect(s.phase).toBe('Draw');
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    expect(s.phase).toBe('Don');
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    expect(s.phase).toBe('Main');
  });

  it('first turn of first player: Draw phase is SKIPPED (hand size unchanged)', () => {
    let s = postMulligan();
    const handBefore = s.players[0].hand.length;
    s = apply(s, { kind: 'PassPhase', player: 0 }).state; // Refresh → Draw (skipped)
    expect(s.phase).toBe('Draw');
    expect(s.players[0].hand.length).toBe(handBefore);
  });

  it('first turn of first player: DON phase adds only 1 (not 2)', () => {
    let s = postMulligan();
    s = apply(s, { kind: 'PassPhase', player: 0 }).state; // Refresh → Draw
    s = apply(s, { kind: 'PassPhase', player: 0 }).state; // Draw → Don
    s = apply(s, { kind: 'PassPhase', player: 0 }).state; // Don → Main
    expect(s.players[0].donActive).toBe(1);
    expect(s.players[0].donDeck).toBe(9);
  });

  it('EndTurn from Main advances activePlayer and resets flags', () => {
    let s = postMulligan();
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    s = apply(s, { kind: 'PassPhase', player: 0 }).state; // in Main now
    s = apply(s, { kind: 'EndTurn', player: 0 }).state;
    expect(s.activePlayer).toBe(1);
    expect(s.phase).toBe('Refresh');
    expect(s.isFirstTurnOfFirstPlayer).toBe(false);
    expect(s.turn).toBe(2);
  });

  it('player 1 first turn: Draw IS executed (hand +1)', () => {
    let s = postMulligan();
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    s = apply(s, { kind: 'EndTurn', player: 0 }).state;
    const handBefore = s.players[1].hand.length;
    s = apply(s, { kind: 'PassPhase', player: 1 }).state; // Refresh → Draw (drew on entry)
    expect(s.phase).toBe('Draw');
    expect(s.players[1].hand.length).toBe(handBefore + 1);
  });

  it('player 1 DON phase adds 2 (not first turn)', () => {
    let s = postMulligan();
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    s = apply(s, { kind: 'EndTurn', player: 0 }).state; // turn over
    s = apply(s, { kind: 'PassPhase', player: 1 }).state; // Refresh → Draw (drew)
    s = apply(s, { kind: 'PassPhase', player: 1 }).state; // Draw → Don (2 don)
    expect(s.players[1].donActive).toBe(2);
    expect(s.players[1].donDeck).toBe(8);
  });

  it('Refresh resets rested leader and moves rested DON to active', () => {
    let s = postMulligan();
    // Mock rested state for p0 (before they PassPhase out of Refresh)
    // But Refresh runs on ENTRY (post-mulligan close), so we need to rest THEN pass EndTurn → come back.
    // Simpler: after first Refresh already ran, advance to Main, EndTurn for p0, then mutate p1 rested state,
    // then PassPhase p1's refresh.
    s = apply(s, { kind: 'PassPhase', player: 0 }).state; // Refresh → Draw
    s = apply(s, { kind: 'PassPhase', player: 0 }).state; // Draw → Don
    s = apply(s, { kind: 'PassPhase', player: 0 }).state; // Don → Main
    s = apply(s, { kind: 'EndTurn', player: 0 }).state; // turn 2, p1's Refresh already ran on entry
    // Force p1 to have a rested leader & rested DON, then run another Refresh by re-entering
    // Easier: manually call createInitialState scenario for the activePlayer Refresh entry.
    const mutated: GameState = {
      ...s,
      phase: 'End', // pretend we're at End, about to re-enter Refresh via EndTurn
      players: [
        s.players[0],
        {
          ...s.players[1],
          leader: { ...s.players[1].leader, rested: true },
          donActive: 0,
          donRested: 3,
        },
      ],
    };
    // Now EndTurn for p1 to start p0's turn with Refresh; but to test p1's refresh, we need p1 as activePlayer.
    // The post-EndTurn(p0) already made p1 active and ran their Refresh. Reset by crafting a fresh re-entry:
    // Simulate: swap active back to p1 and invoke endTurn(p1) which triggers p0 Refresh — not what we want.
    // Alternative test: verify active player's Refresh resets their own leader/don upon EndTurn of opponent.
    // So: build a state where p0 is rested, call EndTurn on p1, check p0.leader.rested after.
    const mutated2: GameState = {
      ...mutated,
      activePlayer: 1, // p1 is active
      phase: 'Main',
      players: [
        {
          ...s.players[0],
          leader: { ...s.players[0].leader, rested: true },
          donActive: 0,
          donRested: 3,
        },
        s.players[1],
      ],
    };
    const res = apply(mutated2, { kind: 'EndTurn', player: 1 });
    expect(res.error).toBeUndefined();
    // After EndTurn, active becomes p0 and p0's Refresh runs
    expect(res.state.activePlayer).toBe(0);
    expect(res.state.players[0].leader.rested).toBe(false);
    expect(res.state.players[0].donActive).toBe(3);
    expect(res.state.players[0].donRested).toBe(0);
  });

  it('Unknown action kind errors gracefully', () => {
    const s = postMulligan();
    const badAction = { kind: 'NotAnAction', player: 0 } as unknown as Action;
    const res = apply(s, badAction);
    expect(res.error?.code).toBe('Unknown');
  });

  it('EndTurn from non-Main phase returns WrongPhase', () => {
    const s = postMulligan(); // phase = Refresh
    const res = apply(s, { kind: 'EndTurn', player: 0 });
    expect(res.error?.code).toBe('WrongPhase');
  });

  it('PassPhase from wrong player returns NotYourPriority', () => {
    const s = postMulligan();
    const res = apply(s, { kind: 'PassPhase', player: 1 });
    expect(res.error?.code).toBe('NotYourPriority');
  });

  it('deck empty on Draw → opponent wins', () => {
    // Force p1's deck to be empty going into their Draw phase.
    let s = postMulligan();
    // Advance to Main for p0 then EndTurn
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    s = apply(s, { kind: 'EndTurn', player: 0 }).state; // p1's Refresh ran on entry
    // Manually empty p1's deck
    s = {
      ...s,
      players: [s.players[0], { ...s.players[1], deck: [] }],
    };
    // Now PassPhase for p1 triggers Draw entry → deck empty → p0 wins
    const res = apply(s, { kind: 'PassPhase', player: 1 });
    expect(res.state.winner).toBe(0);
    expect(res.state.phase).toBe('GameOver');
  });

  it('actions after game over return GameAlreadyOver error', () => {
    let s = postMulligan();
    s = { ...s, winner: 1, phase: 'GameOver' };
    const res = apply(s, { kind: 'PassPhase', player: 0 });
    expect(res.error?.code).toBe('GameAlreadyOver');
  });
});

describe('legalActions', () => {
  it('in Mulligan, returns two mulligan actions for current priority player', () => {
    const s0 = createInitialState(mkSetup());
    const res = apply(s0, { kind: 'Mulligan', player: 0, mulligan: false });
    const legal = res.legalActions;
    expect(legal.some((a) => a.kind === 'Mulligan' && a.player === 1 && a.mulligan === true)).toBe(
      true,
    );
    expect(legal.some((a) => a.kind === 'Mulligan' && a.player === 1 && a.mulligan === false)).toBe(
      true,
    );
    expect(legal.length).toBe(2);
  });

  it('in Refresh phase, PassPhase is legal for active player', () => {
    const s = postMulligan();
    expect(s.phase).toBe('Refresh');
    const res = apply(s, { kind: 'PassPhase', player: 0 });
    // res.state now in Draw; legalActions applies to that state
    expect(res.legalActions.some((a) => a.kind === 'PassPhase' && a.player === 0)).toBe(true);
  });

  it('in Main phase, EndTurn and PassPhase are legal', () => {
    let s = postMulligan();
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    const res = apply(s, { kind: 'PassPhase', player: 0 });
    expect(res.state.phase).toBe('Main');
    expect(res.legalActions.some((a) => a.kind === 'EndTurn')).toBe(true);
  });

  it('after game over, legalActions is empty', () => {
    let s = postMulligan();
    s = { ...s, winner: 1, phase: 'GameOver' };
    const res = apply(s, { kind: 'PassPhase', player: 0 });
    // Game already over → legalActions must be empty
    expect(res.legalActions).toEqual([]);
  });
});
