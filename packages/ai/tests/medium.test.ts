import { describe, expect, it } from 'vitest';
import { apply, createInitialState, createRng } from '@optcg/engine';
import type { GameState, TargetRef } from '@optcg/engine';
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

  it('picks highest-power target for threat-removal (ko) effect', () => {
    const base = createInitialState(mkSetup());
    const targets: TargetRef[] = [
      { kind: 'Leader', owner: 1 }, // leader: base power 5000
      { kind: 'Leader', owner: 0 }, // leader: base power 5000 (same)
    ];
    // Give player 1's leader extra powerThisTurn so it's strictly higher
    const stateWithBoostedOpp: GameState = {
      ...base,
      players: [
        base.players[0],
        {
          ...base.players[1],
          leader: { ...base.players[1].leader, powerThisTurn: 3000 },
        },
      ],
      priorityWindow: {
        kind: 'EffectTargetSelection',
        sourceCardId: 'TEST-EVENT-KO',
        sourceOwner: 0,
        effect: { kind: 'ko', target: { kind: 'opponentCharacter' } },
        validTargets: targets,
        optional: false,
        pendingChain: [],
      },
    };
    const d = MediumBot.pick(stateWithBoostedOpp, 0, createRng(1));
    // Leader owner=1 has 5000+3000=8000 effective power → index 0
    expect(d.action).toEqual({
      kind: 'SelectEffectTarget',
      player: 0,
      targetIndex: 0,
    });
  });

  it('picks index 0 when only one target available', () => {
    const base = createInitialState(mkSetup());
    const stateWithSingleTarget: GameState = {
      ...base,
      priorityWindow: {
        kind: 'EffectTargetSelection',
        sourceCardId: 'TEST-EVENT-KO',
        sourceOwner: 0,
        effect: { kind: 'ko', target: { kind: 'opponentCharacter' } },
        validTargets: [{ kind: 'Leader', owner: 1 }],
        optional: false,
        pendingChain: [],
      },
    };
    const d = MediumBot.pick(stateWithSingleTarget, 0, createRng(1));
    expect(d.action).toEqual({ kind: 'SelectEffectTarget', player: 0, targetIndex: 0 });
  });

  it('returns targetIndex null when no valid targets', () => {
    const base = createInitialState(mkSetup());
    const stateNoTargets: GameState = {
      ...base,
      priorityWindow: {
        kind: 'EffectTargetSelection',
        sourceCardId: 'TEST-EVENT-KO',
        sourceOwner: 0,
        effect: { kind: 'ko', target: { kind: 'opponentCharacter' } },
        validTargets: [],
        optional: false,
        pendingChain: [],
      },
    };
    const d = MediumBot.pick(stateNoTargets, 0, createRng(1));
    expect(d.action).toEqual({ kind: 'SelectEffectTarget', player: 0, targetIndex: null });
  });
});
