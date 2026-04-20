import type { Action } from './types/action';
import type { GameState, PlayerIndex } from './types/state';
import type { EngineError } from './types/error';
import type { GameEvent } from './types/event';
import { shuffle } from './rng';
import { computeLegalActions } from './helpers/legal-actions';
import { runRefresh } from './phases/refresh';
import { runDraw } from './phases/draw';
import { runDon } from './phases/don';
import { runEnd } from './phases/end';
import { playCharacter, playEvent, playStage } from './phases/main';

export interface ApplyResult {
  state: GameState;
  events: GameEvent[];
  legalActions: Action[];
  error?: EngineError;
}

function errorResult(state: GameState, error: EngineError): ApplyResult {
  return { state, events: [], legalActions: computeLegalActions(state), error };
}

function successResult(state: GameState, events: GameEvent[]): ApplyResult {
  return { state, events, legalActions: computeLegalActions(state) };
}

export function apply(state: GameState, action: Action): ApplyResult {
  if (state.winner !== null || state.phase === 'GameOver') {
    return errorResult(state, { code: 'GameAlreadyOver' });
  }

  let events: GameEvent[] = [];
  let next: GameState = state;

  switch (action.kind) {
    case 'Mulligan': {
      if (state.priorityWindow?.kind !== 'Mulligan') {
        return errorResult(state, { code: 'NotYourPriority' });
      }
      if (state.priorityWindow.player !== action.player) {
        return errorResult(state, { code: 'NotYourPriority' });
      }
      const res = doMulligan(state, action.player, action.mulligan);
      next = res.state;
      events = res.events;
      break;
    }

    case 'PassPhase': {
      if (state.priorityWindow !== null) {
        return errorResult(state, { code: 'NotYourPriority' });
      }
      if (action.player !== state.activePlayer) {
        return errorResult(state, { code: 'NotYourPriority' });
      }
      if (state.phase === 'Main') {
        // Use EndTurn to leave Main, not PassPhase.
        return errorResult(state, {
          code: 'WrongPhase',
          expected: ['Refresh', 'Draw', 'Don'],
          actual: state.phase,
        });
      }
      if (state.phase !== 'Refresh' && state.phase !== 'Draw' && state.phase !== 'Don') {
        return errorResult(state, {
          code: 'WrongPhase',
          expected: ['Refresh', 'Draw', 'Don'],
          actual: state.phase,
        });
      }
      const res = advancePhase(state);
      next = res.state;
      events = res.events;
      break;
    }

    case 'EndTurn': {
      if (state.phase !== 'Main') {
        return errorResult(state, {
          code: 'WrongPhase',
          expected: ['Main'],
          actual: state.phase,
        });
      }
      if (action.player !== state.activePlayer) {
        return errorResult(state, { code: 'NotYourPriority' });
      }
      const endRes = runEnd(state);
      const nextTurnRes = startNextTurn(endRes.state);
      next = nextTurnRes.state;
      events = [...endRes.events, ...nextTurnRes.events];
      break;
    }

    case 'PlayCharacter': {
      const r = playCharacter(state, action);
      if (r.error) return errorResult(state, r.error);
      next = r.state;
      events = r.events;
      break;
    }

    case 'PlayEvent': {
      const r = playEvent(state, action);
      if (r.error) return errorResult(state, r.error);
      next = r.state;
      events = r.events;
      break;
    }

    case 'PlayStage': {
      const r = playStage(state, action);
      if (r.error) return errorResult(state, r.error);
      next = r.state;
      events = r.events;
      break;
    }

    default:
      return errorResult(state, {
        code: 'Unknown',
        detail: `action not implemented: ${(action as Action).kind}`,
      });
  }

  return successResult({ ...next, log: [...next.log, action] }, events);
}

function doMulligan(
  state: GameState,
  player: PlayerIndex,
  mulligan: boolean,
): { state: GameState; events: GameEvent[] } {
  let nextState: GameState = state;
  if (mulligan) {
    const p = state.players[player];
    // Put current 5 cards back into deck, shuffle, draw new 5.
    const combined = [...p.deck, ...p.hand];
    const { result: shuffled, rng } = shuffle(combined, state.rng);
    const newHand = shuffled.slice(0, 5);
    const newDeck = shuffled.slice(5);
    nextState = {
      ...state,
      rng,
      players: state.players.map((pp, i) =>
        i === player ? { ...pp, hand: newHand, deck: newDeck, mulliganTaken: true } : pp,
      ) as GameState['players'],
    };
  } else {
    nextState = {
      ...state,
      players: state.players.map((pp, i) =>
        i === player ? { ...pp, mulliganTaken: true } : pp,
      ) as GameState['players'],
    };
  }

  const other: PlayerIndex = player === 0 ? 1 : 0;
  if (!nextState.players[other].mulliganTaken) {
    return {
      state: { ...nextState, priorityWindow: { kind: 'Mulligan', player: other } },
      events: [],
    };
  }

  // Both mulligans resolved. Close the window, enter turn 1, run active player's Refresh.
  const opened: GameState = {
    ...nextState,
    priorityWindow: null,
    turn: 1,
  };
  const refreshed = runRefresh(opened);
  return { state: refreshed.state, events: refreshed.events };
}

function advancePhase(state: GameState): { state: GameState; events: GameEvent[] } {
  switch (state.phase) {
    case 'Refresh':
      // Enter Draw (running its on-entry logic).
      return runDraw(state);
    case 'Draw':
      return runDon(state);
    case 'Don':
      return {
        state: { ...state, phase: 'Main' },
        events: [{ kind: 'PhaseEntered', phase: 'Main' }],
      };
    default:
      return { state, events: [] };
  }
}

function startNextTurn(state: GameState): { state: GameState; events: GameEvent[] } {
  const nextActive: PlayerIndex = state.activePlayer === 0 ? 1 : 0;
  const preRefresh: GameState = {
    ...state,
    activePlayer: nextActive,
    isFirstTurnOfFirstPlayer: false,
    turn: state.turn + 1,
  };
  return runRefresh(preRefresh);
}
