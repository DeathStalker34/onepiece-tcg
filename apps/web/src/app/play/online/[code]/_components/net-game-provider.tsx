'use client';

import { useEffect, useMemo, type ReactNode } from 'react';
import type { Action, GameEvent } from '@optcg/engine';
import { GameContext, type GameContextValue } from '@/app/play/_shared/game-context';
import type { OnlineHook } from '@/lib/online/use-online-socket';

export function NetGameProvider({ online, children }: { online: OnlineHook; children: ReactNode }) {
  const value = useMemo<GameContextValue | null>(() => {
    if (!online.state) return null;
    return {
      state: online.state,
      dispatch: (action: Action) => {
        void online.proposeAction(action);
        return { events: [] as GameEvent[] };
      },
      dispatchBatch: (actions: Action[]) => {
        void online.proposeActionBatch(actions);
        return { events: [] as GameEvent[] };
      },
      events: online.events,
      botPlayers: {},
      botThinking: false,
      lastBotAction: null,
      isOnline: true,
      forfeit: online.forfeit,
      rematch: online.rematch,
      lastGameOverReason: online.lastGameOver?.reason,
    };
  }, [online]);

  useEffect(() => {
    const ev = new CustomEvent('optcg:opponent', {
      detail: { disconnected: online.opponentDisconnected },
    });
    window.dispatchEvent(ev);
  }, [online.opponentDisconnected]);

  if (!value) return null;
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
