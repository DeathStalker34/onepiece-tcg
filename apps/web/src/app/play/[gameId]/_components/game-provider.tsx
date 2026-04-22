'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Action, EngineError, GameEvent, GameState, MatchSetup } from '@optcg/engine';
import { apply, createInitialState } from '@optcg/engine';

interface DispatchResult {
  error?: EngineError;
  events: GameEvent[];
}

interface GameContextValue {
  state: GameState;
  dispatch: (action: Action) => DispatchResult;
  dispatchBatch: (actions: Action[]) => DispatchResult;
  events: GameEvent[];
}

const GameContext = createContext<GameContextValue | null>(null);

const AUTO_PHASES = new Set<GameState['phase']>(['Refresh', 'Draw', 'Don']);

export function GameProvider({
  setup,
  aiOpponent: _aiOpponent,
  children,
}: {
  setup: MatchSetup;
  aiOpponent?: 'easy' | 'medium' | null;
  children: ReactNode;
}) {
  const [state, setState] = useState<GameState>(() => createInitialState(setup));
  const [events, setEvents] = useState<GameEvent[]>([]);
  // aiOpponent wired in Task 7; accepted here so /play/[gameId] can forward it.
  void _aiOpponent;

  function dispatch(action: Action): DispatchResult {
    const result = apply(state, action);
    if (!result.error) {
      setState(result.state);
      if (result.events.length > 0) {
        setEvents((prev) => [...prev, ...result.events]);
      }
    }
    return { error: result.error, events: result.events };
  }

  function dispatchBatch(actions: Action[]): DispatchResult {
    let current = state;
    const allEvents: GameEvent[] = [];
    let err: EngineError | undefined;
    for (const action of actions) {
      const result = apply(current, action);
      if (result.error) {
        err = result.error;
        break;
      }
      current = result.state;
      if (result.events.length > 0) {
        allEvents.push(...result.events);
      }
    }
    if (current !== state) {
      setState(current);
      if (allEvents.length > 0) {
        setEvents((prev) => [...prev, ...allEvents]);
      }
    }
    return { error: err, events: allEvents };
  }

  // Auto-advance Refresh/Draw/Don to Main. User only acts in Main or in priority windows.
  useEffect(() => {
    if (state.winner !== null) return;
    if (state.phase === 'GameOver') return;
    if (state.priorityWindow !== null) return;
    if (!AUTO_PHASES.has(state.phase)) return;

    const result = apply(state, { kind: 'PassPhase', player: state.activePlayer });
    if (!result.error) {
      setState(result.state);
      if (result.events.length > 0) {
        setEvents((prev) => [...prev, ...result.events]);
      }
    }
  }, [state]);

  return (
    <GameContext.Provider value={{ state, dispatch, dispatchBatch, events }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
