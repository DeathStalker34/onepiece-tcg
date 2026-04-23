import { describe, expect, it } from 'vitest';
import { apply, createInitialState, createRng } from '@optcg/engine';
import { EasyBot } from '../src/easy';
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

describe('EasyBot.pick', () => {
  it('declines mulligan during mulligan window', () => {
    const s = createInitialState(mkSetup());
    const rng = createRng(1);
    const d = EasyBot.pick(s, 0, rng);
    expect(d.action).toEqual({ kind: 'Mulligan', player: 0, mulligan: false });
  });

  it('PassPhase during Refresh/Draw/Don', () => {
    let s = createInitialState(mkSetup());
    s = apply(s, { kind: 'Mulligan', player: 0, mulligan: false }).state;
    s = apply(s, { kind: 'Mulligan', player: 1, mulligan: false }).state;
    const rng = createRng(1);
    const d = EasyBot.pick(s, 0, rng);
    expect(d.action.kind).toBe('PassPhase');
  });

  it('in Main, picks an action the engine accepts', () => {
    let s = createInitialState(mkSetup());
    s = apply(s, { kind: 'Mulligan', player: 0, mulligan: false }).state;
    s = apply(s, { kind: 'Mulligan', player: 1, mulligan: false }).state;
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    for (let seed = 1; seed < 20; seed += 1) {
      const d = EasyBot.pick(s, 0, createRng(seed));
      const r = apply(s, d.action);
      expect(r.error).toBeUndefined();
    }
  });

  it('advances RNG pointer when picking a random main action', () => {
    let s = createInitialState(mkSetup());
    s = apply(s, { kind: 'Mulligan', player: 0, mulligan: false }).state;
    s = apply(s, { kind: 'Mulligan', player: 1, mulligan: false }).state;
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    const rng0 = createRng(5);
    const d = EasyBot.pick(s, 0, rng0);
    expect(d.rng.pointer).toBeGreaterThan(rng0.pointer);
  });
});
