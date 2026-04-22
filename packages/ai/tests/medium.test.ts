import { describe, expect, it } from 'vitest';
import { apply, createInitialState, createRng } from '@optcg/engine';
import { MediumBot } from '../src/medium';
import { TEST_CATALOG } from './fixtures/test-cards';
import { simpleRedDeck50 } from './fixtures/simple-red-deck';

function mkSetup(seed = 42) {
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

describe('MediumBot.pick', () => {
  it('declines mulligan', () => {
    const s = createInitialState(mkSetup());
    const d = MediumBot.pick(s, 0, createRng(1));
    expect(d.action).toEqual({ kind: 'Mulligan', player: 0, mulligan: false });
  });

  it('in Main first turn (no attacks available), picks legal action', () => {
    let s = createInitialState(mkSetup());
    s = apply(s, { kind: 'Mulligan', player: 0, mulligan: false }).state;
    s = apply(s, { kind: 'Mulligan', player: 1, mulligan: false }).state;
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    const d = MediumBot.pick(s, 0, createRng(1));
    const r = apply(s, d.action);
    expect(r.error).toBeUndefined();
  });
});
