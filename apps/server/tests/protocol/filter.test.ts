import { describe, it, expect } from 'vitest';
import { filterStateForPlayer } from '../../src/protocol/filter';
import { HIDDEN_CARD_ID } from '@optcg/protocol';
import type { GameState, PlayerState } from '@optcg/engine';

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    playerId: 'p',
    leader: { cardId: 'OP01-001', rested: false, attachedDon: 0, powerThisTurn: 0 },
    deck: ['C1', 'C2', 'C3'],
    hand: ['C4', 'C5'],
    life: ['C6', 'C7'],
    trash: [],
    banishZone: [],
    characters: [],
    stage: null,
    donActive: 0,
    donRested: 0,
    donDeck: 10,
    mulliganTaken: false,
    firstTurnUsed: false,
    ...overrides,
  };
}

function makeState(): GameState {
  return {
    turn: 1,
    activePlayer: 0,
    phase: 'Main',
    priorityWindow: null,
    players: [
      makePlayer({ playerId: 'alice' }),
      makePlayer({ playerId: 'bob', hand: ['B1', 'B2', 'B3'] }),
    ],
    rng: { seed: 1, pointer: 0 },
    log: [],
    winner: null,
    catalog: {},
    isFirstTurnOfFirstPlayer: true,
  };
}

describe('filterStateForPlayer', () => {
  it('hides opponent hand/life/deck for player 0', () => {
    const filtered = filterStateForPlayer(makeState(), 0);
    expect(filtered.players[0].hand).toEqual(['C4', 'C5']);
    expect(filtered.players[1].hand).toEqual([HIDDEN_CARD_ID, HIDDEN_CARD_ID, HIDDEN_CARD_ID]);
    expect(filtered.players[1].life).toEqual([HIDDEN_CARD_ID, HIDDEN_CARD_ID]);
    expect(filtered.players[1].deck).toEqual([HIDDEN_CARD_ID, HIDDEN_CARD_ID, HIDDEN_CARD_ID]);
  });

  it('preserves zone counts (array length)', () => {
    const filtered = filterStateForPlayer(makeState(), 0);
    expect(filtered.players[1].hand).toHaveLength(3);
    expect(filtered.players[1].life).toHaveLength(2);
    expect(filtered.players[1].deck).toHaveLength(3);
  });

  it('does not mutate input state', () => {
    const state = makeState();
    filterStateForPlayer(state, 0);
    expect(state.players[1].hand).toEqual(['B1', 'B2', 'B3']);
  });
});
