import { describe, it, expect } from 'vitest';
import { apply, createInitialState } from '../../src/index';
import type { CardStatic } from '../../src/types/card';
import type { MatchSetup } from '../../src/types/state';

const LEADER_WITH_ACTIVATE: CardStatic = {
  id: 'L1',
  type: 'LEADER',
  colors: ['Red'],
  cost: null,
  power: 5000,
  life: 5,
  counter: null,
  keywords: [],
  effects: [
    {
      trigger: 'Activate:Main',
      cost: { donX: 2 },
      effect: { kind: 'draw', amount: 1 },
    },
  ],
  manualText: null,
};

const FILLER: CardStatic = {
  id: 'F',
  type: 'CHARACTER',
  colors: ['Red'],
  cost: 1,
  power: 2000,
  life: null,
  counter: 1000,
  keywords: [],
  effects: [],
  manualText: null,
};

function setup(): MatchSetup {
  return {
    seed: 42,
    firstPlayer: 0,
    players: [
      { playerId: 'a', leaderCardId: 'L1', deck: Array(50).fill('F') },
      { playerId: 'b', leaderCardId: 'L1', deck: Array(50).fill('F') },
    ],
    catalog: { L1: LEADER_WITH_ACTIVATE, F: FILLER },
  };
}

function reachMain(state0: ReturnType<typeof createInitialState>) {
  let s = state0;
  // Both mulligans
  s = apply(s, { kind: 'Mulligan', player: 0, mulligan: false }).state;
  s = apply(s, { kind: 'Mulligan', player: 1, mulligan: false }).state;
  while (s.phase !== 'Main') {
    s = apply(s, { kind: 'PassPhase', player: s.activePlayer }).state;
  }
  return s;
}

describe('Activate:Main with DON cost', () => {
  it('rejects ActivateMain when not enough DON', () => {
    let s = reachMain(createInitialState(setup()));
    // Force donActive = 0 to be sure
    s = {
      ...s,
      players: s.players.map((p, i) => (i === 0 ? { ...p, donActive: 0 } : p)) as typeof s.players,
    };
    const r = apply(s, { kind: 'ActivateMain', player: 0, source: { kind: 'Leader' } });
    expect(r.error).toEqual({ code: 'NotEnoughDon', need: 2, have: 0 });
  });

  it('rests N DON and applies effect when enough DON', () => {
    let s = reachMain(createInitialState(setup()));
    // Force enough donActive
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, donActive: 3, donRested: 0 } : p,
      ) as typeof s.players,
    };
    const handBefore = s.players[0].hand.length;
    const r = apply(s, { kind: 'ActivateMain', player: 0, source: { kind: 'Leader' } });
    expect(r.error).toBeUndefined();
    expect(r.state.players[0].donActive).toBe(1);
    expect(r.state.players[0].donRested).toBe(2);
    expect(r.state.players[0].hand.length).toBe(handBefore + 1);
  });
});
