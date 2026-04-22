import { describe, expect, it } from 'vitest';
import {
  apply,
  createInitialState,
  createRng,
  type GameState,
  type PlayerIndex,
  type RngState,
} from '@optcg/engine';
import { EasyBot } from '../src/easy';
import { MediumBot } from '../src/medium';
import type { Bot } from '../src/types';
import { TEST_CATALOG } from './fixtures/test-cards';
import { simpleRedDeck50 } from './fixtures/simple-red-deck';

function mkSetup(seed: number) {
  return {
    seed,
    firstPlayer: 0 as const,
    players: [
      { playerId: 'p0', leaderCardId: 'TEST-LEADER-01', deck: simpleRedDeck50() },
      { playerId: 'p1', leaderCardId: 'TEST-LEADER-02', deck: simpleRedDeck50() },
    ] as [
      { playerId: string; leaderCardId: string; deck: string[] },
      { playerId: string; leaderCardId: string; deck: string[] },
    ],
    catalog: TEST_CATALOG,
  };
}

function actorForPriority(state: GameState): PlayerIndex | null {
  const pw = state.priorityWindow;
  if (!pw) return null;
  if (pw.kind === 'Mulligan') return pw.player;
  if (pw.kind === 'CounterStep') return pw.defender.owner;
  if (pw.kind === 'BlockerStep') return pw.originalTarget.owner;
  if (pw.kind === 'TriggerStep') return pw.owner;
  return null;
}

function playGame(
  p0: Bot,
  p1: Bot,
  seed: number,
  maxActions = 2000,
): { winner: PlayerIndex | null; actions: number } {
  let state = createInitialState(mkSetup(seed));
  let rng: RngState = createRng(seed + 1);
  let count = 0;

  while (state.winner === null && state.phase !== 'GameOver' && count < maxActions) {
    if (
      state.priorityWindow === null &&
      (state.phase === 'Refresh' || state.phase === 'Draw' || state.phase === 'Don')
    ) {
      const res = apply(state, { kind: 'PassPhase', player: state.activePlayer });
      if (res.error) {
        throw new Error(
          `Auto PassPhase error at action ${count}: ${JSON.stringify(res.error)} state.phase=${state.phase}`,
        );
      }
      state = res.state;
      count += 1;
      continue;
    }

    const actor = actorForPriority(state) ?? state.activePlayer;
    const bot = actor === 0 ? p0 : p1;
    const decision = bot.pick(state, actor, rng);
    rng = decision.rng;
    const res = apply(state, decision.action);
    if (res.error) {
      throw new Error(
        `Bot ${bot.id} illegal action at ${count} (${decision.action.kind}): ${JSON.stringify(res.error)}`,
      );
    }
    state = res.state;
    count += 1;
  }

  return { winner: state.winner, actions: count };
}

describe('Easy vs Easy self-play', () => {
  it('100 games: no engine errors, every game has a winner', () => {
    for (let i = 0; i < 100; i += 1) {
      const r = playGame(EasyBot, EasyBot, 1000 + i);
      expect(r.winner).not.toBeNull();
    }
  });
});

describe('Medium vs Easy self-play', () => {
  it('Medium wins >=35 of 50 games (>=70%) playing as P0', () => {
    let mediumWins = 0;
    for (let i = 0; i < 50; i += 1) {
      const r = playGame(MediumBot, EasyBot, 2000 + i);
      if (r.winner === 0) mediumWins += 1;
    }
    expect(mediumWins).toBeGreaterThanOrEqual(35);
  });
});
