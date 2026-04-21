'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Action, EngineError, GameEvent, GameState, MatchSetup } from '@optcg/engine';
import { apply, createInitialState } from '@optcg/engine';

interface DispatchResult {
  error?: EngineError;
  events: GameEvent[];
}

interface GameContextValue {
  state: GameState;
  dispatch: (action: Action) => DispatchResult;
  events: GameEvent[];
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ setup, children }: { setup: MatchSetup; children: ReactNode }) {
  const [state, setState] = useState<GameState>(() => createInitialState(setup));
  const [events, setEvents] = useState<GameEvent[]>([]);

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

  return (
    <GameContext.Provider value={{ state, dispatch, events }}>{children}</GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
