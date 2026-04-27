'use client';

import { useEffect, useRef, useState } from 'react';
import type { GameEvent, PlayerIndex } from '@optcg/engine';
import { useGame } from './game-provider';

type ToastVariant = 'info' | 'success' | 'danger' | 'warning';

interface Toast {
  id: number;
  text: string;
  variant: ToastVariant;
}

const TOAST_MS = 1800;

function humanIndex(botPlayers: { 0?: true; 1?: true }): PlayerIndex | null {
  if (botPlayers[0] && !botPlayers[1]) return 1;
  if (botPlayers[1] && !botPlayers[0]) return 0;
  return null;
}

function perspective(
  player: PlayerIndex,
  human: PlayerIndex | null,
): 'you' | 'opponent' | 'neutral' {
  if (human === null) return 'neutral';
  return player === human ? 'you' : 'opponent';
}

function mapEvent(
  ev: GameEvent,
  human: PlayerIndex | null,
): { text: string; variant: ToastVariant } | null {
  switch (ev.kind) {
    case 'CardDrawn': {
      const side = perspective(ev.player, human);
      if (side === 'opponent') return null;
      const who = side === 'you' ? 'You draw' : 'Card drawn';
      return {
        text: ev.count > 1 ? `${who} ${ev.count} cards` : `${who} a card`,
        variant: 'info',
      };
    }
    case 'LifeLost': {
      const side = perspective(ev.player, human);
      if (side === 'you') return { text: 'You lost 1 life', variant: 'danger' };
      if (side === 'opponent') return { text: 'Attack hits — 1 life!', variant: 'success' };
      return { text: `Player ${ev.player} lost 1 life`, variant: 'warning' };
    }
    case 'CharacterKod':
      return { text: 'Character KO\u2019d', variant: 'danger' };
    case 'BlockerUsed':
      return { text: 'Blocker activated', variant: 'warning' };
    case 'AttackBlocked':
      return { text: 'Attack blocked!', variant: 'warning' };
    case 'EffectResolved': {
      const e = ev.effect;
      if (e.kind === 'ko') return { text: 'Character KO\u2019d by effect', variant: 'danger' };
      if (e.kind === 'banish') return { text: 'Character banished', variant: 'danger' };
      if (e.kind === 'returnToHand')
        return { text: 'Character returned to hand', variant: 'warning' };
      if (e.kind === 'power') {
        const sign = e.delta >= 0 ? '+' : '';
        return {
          text: `Power ${sign}${e.delta}`,
          variant: e.delta >= 0 ? 'info' : 'warning',
        };
      }
      if (e.kind === 'draw') {
        return { text: `${ev.sourceCardId} drew ${e.amount}`, variant: 'info' };
      }
      if (e.kind === 'search') {
        return { text: `${ev.sourceCardId} searched`, variant: 'info' };
      }
      return null;
    }
    default:
      return null;
  }
}

function variantClasses(v: ToastVariant): string {
  switch (v) {
    case 'success':
      return 'bg-emerald-600 text-white';
    case 'danger':
      return 'bg-red-600 text-white';
    case 'warning':
      return 'bg-amber-500 text-stone-900';
    case 'info':
    default:
      return 'bg-stone-900/90 text-amber-100';
  }
}

export function ToastCenter() {
  const { state, events, botPlayers } = useGame();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seenIdx = useRef(0);
  const idRef = useRef(0);
  const prevTurn = useRef(state.turn);
  const prevPhase = useRef(state.phase);
  const human = humanIndex(botPlayers);

  const push = (text: string, variant: ToastVariant) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, text, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_MS);
  };

  // Events from the engine
  useEffect(() => {
    if (events.length === seenIdx.current) return;
    const next = events.slice(seenIdx.current);
    seenIdx.current = events.length;
    for (const ev of next) {
      const t = mapEvent(ev, human);
      if (t) push(t.text, t.variant);
    }
  }, [events, human]);

  // Turn start (fires when state.turn advances)
  useEffect(() => {
    if (state.turn === prevTurn.current) return;
    prevTurn.current = state.turn;
    if (state.turn === 0 || state.phase === 'GameOver') return;
    const side = human === null ? 'neutral' : state.activePlayer === human ? 'you' : 'opponent';
    const text =
      side === 'you'
        ? 'Your turn'
        : side === 'opponent'
          ? 'Opponent\u2019s turn'
          : `Turn ${state.turn}`;
    push(text, side === 'you' ? 'success' : 'info');
  }, [state.turn, state.activePlayer, state.phase, human]);

  // Turn end (fires when entering End phase)
  useEffect(() => {
    if (state.phase === prevPhase.current) {
      return;
    }
    const prev = prevPhase.current;
    prevPhase.current = state.phase;
    if (state.phase === 'End' && prev !== 'End') {
      const side = human === null ? 'neutral' : state.activePlayer === human ? 'you' : 'opponent';
      push(side === 'you' ? 'Your turn ends' : 'Opponent turn ends', 'info');
    }
  }, [state.phase, state.activePlayer, human]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-center gap-2"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-full px-6 py-2 text-lg font-semibold shadow-xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-200 ${variantClasses(t.variant)}`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
