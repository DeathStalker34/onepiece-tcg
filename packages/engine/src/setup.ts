import { createRng, shuffle } from './rng';
import type { RngState } from './rng';
import type { GameState, MatchSetup, PlayerState, PlayerIndex } from './types/state';

function buildPlayerState(
  setup: MatchSetup,
  playerIdx: PlayerIndex,
  rngIn: RngState,
): { player: PlayerState; rng: RngState } {
  const ps = setup.players[playerIdx];
  const leaderStatic = setup.catalog[ps.leaderCardId];
  if (!leaderStatic) {
    throw new Error(`Leader card ${ps.leaderCardId} not in catalog`);
  }
  if (leaderStatic.life === null) {
    throw new Error(`Leader card ${ps.leaderCardId} has no life stat`);
  }

  const { result: shuffled, rng: rngAfterShuffle } = shuffle(ps.deck, rngIn);

  const lifeCount = leaderStatic.life;
  const life = shuffled.slice(0, lifeCount);
  const hand = shuffled.slice(lifeCount, lifeCount + 5);
  const deck = shuffled.slice(lifeCount + 5);

  const player: PlayerState = {
    playerId: ps.playerId,
    leader: {
      cardId: ps.leaderCardId,
      rested: false,
      attachedDon: 0,
      powerThisTurn: 0,
    },
    deck,
    hand,
    life,
    trash: [],
    banishZone: [],
    characters: [],
    stage: null,
    donActive: 0,
    donRested: 0,
    donDeck: 10,
    mulliganTaken: false,
    firstTurnUsed: false,
  };

  return { player, rng: rngAfterShuffle };
}

export function createInitialState(setup: MatchSetup): GameState {
  let rng = createRng(setup.seed);

  const p0 = buildPlayerState(setup, 0, rng);
  rng = p0.rng;
  const p1 = buildPlayerState(setup, 1, rng);
  rng = p1.rng;

  return {
    turn: 0,
    activePlayer: setup.firstPlayer,
    phase: 'Setup',
    priorityWindow: { kind: 'Mulligan', player: setup.firstPlayer },
    players: [p0.player, p1.player],
    rng,
    log: [],
    winner: null,
    catalog: setup.catalog,
    isFirstTurnOfFirstPlayer: true,
  };
}
