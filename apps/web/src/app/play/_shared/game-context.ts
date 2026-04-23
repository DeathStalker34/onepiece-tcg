'use client';

import { createContext, useContext } from 'react';
import type { Action, EngineError, GameEvent, GameState } from '@optcg/engine';

export interface BotActionSummary {
  kind: Action['kind'];
  label: string;
  at: number;
}

export interface GameContextValue {
  state: GameState;
  dispatch: (action: Action) => { error?: EngineError; events: GameEvent[] };
  dispatchBatch: (actions: Action[]) => { error?: EngineError; events: GameEvent[] };
  events: GameEvent[];
  botPlayers: { 0?: true; 1?: true };
  botThinking: boolean;
  lastBotAction: BotActionSummary | null;
  isOnline: boolean;
  forfeit?: () => Promise<void>;
  rematch?: (ready: boolean) => Promise<void>;
  lastGameOverReason?: 'engine' | 'forfeit' | 'timeout';
}

export const GameContext = createContext<GameContextValue | null>(null);

export function useGame(): GameContextValue {
  const v = useContext(GameContext);
  if (!v) throw new Error('useGame must be used within a Game provider');
  return v;
}
