import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/setup';
import { apply } from '../src/apply';
import type { Action } from '../src/types/action';
import type { GameState, MatchSetup } from '../src/types/state';
import { TEST_CATALOG } from './fixtures/test-cards';
import { simpleRedDeck50 } from './fixtures/simple-red-deck';

const SEED = 12345;

function mkSetup(): MatchSetup {
  return {
    seed: SEED,
    firstPlayer: 0,
    players: [
      { playerId: 'p0', leaderCardId: 'TEST-LEADER-01', deck: simpleRedDeck50() },
      { playerId: 'p1', leaderCardId: 'TEST-LEADER-02', deck: simpleRedDeck50() },
    ],
    catalog: TEST_CATALOG,
  };
}

/**
 * Given an open priority window, returns actions that decline/pass it as
 * conservatively as possible. Keeps the policy deterministic while exercising
 * Counter/Blocker/Trigger steps without requiring context-sensitive choices.
 */
function resolveOpenWindow(state: GameState): Action[] {
  const pw = state.priorityWindow;
  if (!pw) return [];
  switch (pw.kind) {
    case 'CounterStep':
      return [{ kind: 'DeclineCounter', player: pw.defender.owner }];
    case 'BlockerStep':
      return [{ kind: 'DeclineBlocker', player: pw.originalTarget.owner }];
    case 'TriggerStep':
      return [{ kind: 'ActivateTrigger', player: pw.owner, activate: false }];
    case 'Mulligan':
      return [{ kind: 'Mulligan', player: pw.player, mulligan: false }];
    default:
      return [];
  }
}

/**
 * Deterministic policy (no priority window open):
 *  - Pass non-Main phases.
 *  - In Main: if leader is ready, attack opponent's leader; otherwise end turn.
 * Together with `resolveOpenWindow`, this advances every game to GameOver.
 */
function nextScriptedAction(state: GameState): Action | null {
  const ap = state.activePlayer;
  if (state.phase === 'Refresh' || state.phase === 'Draw' || state.phase === 'Don') {
    return { kind: 'PassPhase', player: ap };
  }
  if (state.phase === 'Main') {
    if (state.players[ap].firstTurnUsed && !state.players[ap].leader.rested) {
      return {
        kind: 'DeclareAttack',
        player: ap,
        attacker: { kind: 'Leader' },
        target: { kind: 'Leader' },
      };
    }
    return { kind: 'EndTurn', player: ap };
  }
  return null;
}

interface RunResult {
  state: GameState;
  actionCount: number;
}

function runUntilGameOver(initial: GameState, maxActions = 500): RunResult {
  let state = initial;
  let count = 0;
  while (state.winner === null && state.phase !== 'GameOver' && count < maxActions) {
    const pending = resolveOpenWindow(state);
    if (pending.length > 0) {
      for (const a of pending) {
        const res = apply(state, a);
        if (res.error) {
          throw new Error(
            `auto-resolve failed at action ${count}: ${JSON.stringify(res.error)} action=${JSON.stringify(
              a,
            )} phase=${state.phase} pw=${JSON.stringify(state.priorityWindow)}`,
          );
        }
        state = res.state;
        count += 1;
      }
      continue;
    }
    const action = nextScriptedAction(state);
    if (!action) break;
    const res = apply(state, action);
    if (res.error) {
      throw new Error(
        `scripted action failed at action ${count}: ${JSON.stringify(res.error)} action=${JSON.stringify(
          action,
        )} phase=${state.phase} activePlayer=${state.activePlayer}`,
      );
    }
    state = res.state;
    count += 1;
  }
  return { state, actionCount: count };
}

describe('e2e scripted game', () => {
  it('runs a complete scripted game to GameOver', () => {
    const initial = createInitialState(mkSetup());
    const { state: finalState, actionCount } = runUntilGameOver(initial);
    expect(finalState.winner).not.toBeNull();
    expect(finalState.phase).toBe('GameOver');
    expect(actionCount).toBeGreaterThan(0);
  });

  it('is deterministic: 10 runs with same seed produce JSON-identical final states', () => {
    const finals: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      const initial = createInitialState(mkSetup());
      const { state: finalState } = runUntilGameOver(initial);
      finals.push(JSON.stringify(finalState));
    }
    expect(new Set(finals).size).toBe(1);
  });

  it('terminates within a reasonable action budget with a clear winner', () => {
    const initial = createInitialState(mkSetup());
    const { state: finalState, actionCount } = runUntilGameOver(initial);
    // Empirically ~55 actions / 9 turns with SEED=12345; generous budget.
    expect(actionCount).toBeLessThan(500);
    expect(finalState.winner === 0 || finalState.winner === 1).toBe(true);
  });
});
