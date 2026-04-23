import { describe, expect, it } from 'vitest';
import { apply, createInitialState } from '@optcg/engine';
import { generatePriorityAction, generateMainActions } from '../src/action-generator';
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

describe('generatePriorityAction', () => {
  it('returns Mulligan false during mulligan window for active player', () => {
    const s = createInitialState(mkSetup());
    const a = generatePriorityAction(s, 0);
    expect(a).toEqual({ kind: 'Mulligan', player: 0, mulligan: false });
  });

  it('returns null when not our priority', () => {
    const s = createInitialState(mkSetup());
    const a = generatePriorityAction(s, 1);
    expect(a).toBeNull();
  });
});

describe('generateMainActions', () => {
  it('returns empty outside Main', () => {
    const s = createInitialState(mkSetup());
    expect(generateMainActions(s, 0)).toEqual([]);
  });

  it('first turn in Main: includes EndTurn + AttachDon, excludes DeclareAttack', () => {
    let s = createInitialState(mkSetup());
    s = apply(s, { kind: 'Mulligan', player: 0, mulligan: false }).state;
    s = apply(s, { kind: 'Mulligan', player: 1, mulligan: false }).state;
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    const actions = generateMainActions(s, 0);
    expect(actions.some((a) => a.kind === 'EndTurn')).toBe(true);
    expect(actions.some((a) => a.kind === 'AttachDon')).toBe(true);
    expect(actions.some((a) => a.kind === 'DeclareAttack')).toBe(false);
  });

  it('all enumerated actions are accepted by the engine', () => {
    let s = createInitialState(mkSetup());
    s = apply(s, { kind: 'Mulligan', player: 0, mulligan: false }).state;
    s = apply(s, { kind: 'Mulligan', player: 1, mulligan: false }).state;
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    s = apply(s, { kind: 'PassPhase', player: 0 }).state;
    const actions = generateMainActions(s, 0);
    for (const action of actions) {
      const res = apply(s, action);
      if (res.error) {
        throw new Error(`Rejected: ${JSON.stringify(action)} → ${JSON.stringify(res.error)}`);
      }
    }
  });
});
