'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { GameState, PlayerIndex } from '@optcg/engine';
import { useGame } from '../game-provider';
import { parseDragId, parseDropId } from './ids';
import { resolveDrop, computeValidDropIds, getLegalActions } from './use-board-dnd';
import { CardDragOverlay, DonDragOverlay } from './drag-overlay';

interface DndBoardCtxValue {
  activeDragId: string | null;
  validDropIds: Set<string>;
}

const DndBoardCtx = createContext<DndBoardCtxValue>({
  activeDragId: null,
  validDropIds: new Set(),
});

export function useDndBoard(): DndBoardCtxValue {
  return useContext(DndBoardCtx);
}

export function DndBoardProvider({ children }: { children: ReactNode }) {
  const { state, dispatch, isOnline, myPlayerIndex } = useGame();
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const localPlayer: PlayerIndex = isOnline && myPlayerIndex !== null ? myPlayerIndex : 0;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const validDropIds = useMemo<Set<string>>(() => {
    if (!activeDragId) return new Set();
    const drag = parseDragId(activeDragId);
    if (!drag) return new Set();
    return computeValidDropIds(drag, getLegalActions(state as GameState), localPlayer);
  }, [activeDragId, state, localPlayer]);

  const onDragStart = useCallback((e: DragStartEvent) => {
    setActiveDragId(String(e.active.id));
  }, []);

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveDragId(null);
      const drag = parseDragId(String(e.active.id));
      if (!drag) return;
      const drop = e.over ? parseDropId(String(e.over.id)) : null;
      const action = resolveDrop(drag, drop, getLegalActions(state as GameState));
      if (action) dispatch(action);
    },
    [state, dispatch],
  );

  const onDragCancel = useCallback(() => setActiveDragId(null), []);

  const overlayContent = useMemo(() => {
    if (!activeDragId) return null;
    const drag = parseDragId(activeDragId);
    if (!drag) return null;
    if (drag.kind === 'hand') {
      const cardId = state.players[localPlayer].hand[drag.handIndex];
      return cardId ? <CardDragOverlay cardId={cardId} /> : null;
    }
    if (drag.kind === 'don') return <DonDragOverlay />;
    if (drag.kind === 'attacker-leader') {
      return <CardDragOverlay cardId={state.players[localPlayer].leader.cardId} />;
    }
    if (drag.kind === 'attacker-char') {
      const c = state.players[localPlayer].characters.find((x) => x.instanceId === drag.instanceId);
      return c ? <CardDragOverlay cardId={c.cardId} /> : null;
    }
    return null;
  }, [activeDragId, state, localPlayer]);

  const ctxValue = useMemo<DndBoardCtxValue>(
    () => ({ activeDragId, validDropIds }),
    [activeDragId, validDropIds],
  );

  return (
    <DndBoardCtx.Provider value={ctxValue}>
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        {children}
        <DragOverlay>{overlayContent}</DragOverlay>
      </DndContext>
    </DndBoardCtx.Provider>
  );
}
