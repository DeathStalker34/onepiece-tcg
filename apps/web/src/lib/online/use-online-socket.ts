'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Action, GameEvent, GameState, PlayerIndex } from '@optcg/engine';
import type { ClientMsg, LobbyPlayer, MatchStatus, ServerMsg } from '@optcg/protocol';
import { loadSession, saveSession } from './session-storage';

export interface OnlineHookState {
  phase: 'connecting' | 'idle' | 'lobby' | 'playing' | 'finished';
  matchId: string | null;
  playerIndex: PlayerIndex | null;
  token: string | null;
  lobby: { players: (LobbyPlayer | null)[]; status: MatchStatus } | null;
  state: GameState | null;
  events: GameEvent[];
  opponentDisconnected: boolean;
  error: string | null;
  lastGameOver: { winner: PlayerIndex; reason: 'engine' | 'forfeit' | 'timeout' } | null;
}

export interface OnlineHook extends OnlineHookState {
  createMatch: (nickname: string) => Promise<void>;
  joinMatch: (matchId: string, nickname: string) => Promise<void>;
  submitDeck: (leaderCardId: string, deck: string[]) => Promise<void>;
  setReady: (ready: boolean) => Promise<void>;
  proposeAction: (action: Action) => Promise<void>;
  proposeActionBatch: (actions: Action[]) => Promise<void>;
  rematch: (ready: boolean) => Promise<void>;
  forfeit: () => Promise<void>;
}

const initialState: OnlineHookState = {
  phase: 'connecting',
  matchId: null,
  playerIndex: null,
  token: null,
  lobby: null,
  state: null,
  events: [],
  opponentDisconnected: false,
  error: null,
  lastGameOver: null,
};

const ACTION_TIMEOUT_MS = 5000;

export function useOnlineSocket(bootMatchId?: string): OnlineHook {
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3001';
  const [s, setS] = useState<OnlineHookState>({
    ...initialState,
    matchId: bootMatchId ?? null,
  });
  const socketRef = useRef<Socket | null>(null);
  const pendingRef = useRef<{ resolve: () => void; reject: (e: Error) => void } | null>(null);

  const send = useCallback((msg: ClientMsg) => {
    socketRef.current?.emit('msg', msg);
  }, []);

  const sendExpectingState = useCallback(
    (msg: ClientMsg): Promise<void> => {
      return new Promise((resolve, reject) => {
        pendingRef.current = { resolve, reject };
        send(msg);
        setTimeout(() => {
          if (pendingRef.current) {
            pendingRef.current.reject(new Error('Timed out waiting for server'));
            pendingRef.current = null;
          }
        }, ACTION_TIMEOUT_MS);
      });
    },
    [send],
  );

  useEffect(() => {
    const sock = io(serverUrl, { reconnection: true, reconnectionDelay: 500 });
    socketRef.current = sock;

    sock.on('connect', () => {
      setS((prev) => ({ ...prev, phase: prev.matchId ? 'connecting' : 'idle' }));
      if (bootMatchId) {
        const session = loadSession(bootMatchId);
        if (session) {
          setS((prev) => ({ ...prev, token: session.token, playerIndex: session.playerIndex }));
          sock.emit('msg', { kind: 'Reconnect', matchId: bootMatchId, token: session.token });
        }
      }
    });

    sock.on('msg', (raw: ServerMsg) => {
      switch (raw.kind) {
        case 'MatchCreated':
          saveSession(raw.matchId, { token: raw.token, nickname: '', playerIndex: 0 });
          setS((p) => ({
            ...p,
            matchId: raw.matchId,
            token: raw.token,
            playerIndex: 0,
            phase: 'lobby',
          }));
          break;
        case 'MatchJoined':
          saveSession(raw.matchId, { token: raw.token, nickname: '', playerIndex: 1 });
          setS((p) => ({
            ...p,
            matchId: raw.matchId,
            token: raw.token,
            playerIndex: 1,
            phase: 'lobby',
          }));
          break;
        case 'LobbyUpdate':
          setS((p) => ({
            ...p,
            lobby: { players: raw.players, status: raw.matchStatus },
            phase: raw.matchStatus === 'playing' ? 'playing' : 'lobby',
          }));
          break;
        case 'GameStart':
          setS((p) => ({
            ...p,
            phase: 'playing',
            state: raw.initialState,
            events: [],
            lastGameOver: null,
          }));
          pendingRef.current?.resolve();
          pendingRef.current = null;
          break;
        case 'StateUpdate':
          setS((p) => ({
            ...p,
            state: raw.state,
            events: [...p.events, ...raw.events],
            phase:
              raw.state.winner !== null || raw.state.phase === 'GameOver' ? 'finished' : 'playing',
          }));
          pendingRef.current?.resolve();
          pendingRef.current = null;
          break;
        case 'ActionRejected': {
          const detail =
            (raw.reason as unknown as { detail?: string }).detail ??
            (raw.reason as unknown as { reason?: string }).reason ??
            '';
          pendingRef.current?.reject(
            new Error(`Action rejected: ${raw.reason.code}${detail ? ` (${detail})` : ''}`),
          );
          pendingRef.current = null;
          break;
        }
        case 'OpponentDisconnected':
          setS((p) => ({ ...p, opponentDisconnected: true }));
          break;
        case 'OpponentReconnected':
          setS((p) => ({ ...p, opponentDisconnected: false }));
          break;
        case 'GameOver':
          setS((p) => ({
            ...p,
            phase: 'finished',
            state: p.state ? { ...p.state, winner: raw.winner, phase: 'GameOver' } : p.state,
            lastGameOver: { winner: raw.winner, reason: raw.reason },
          }));
          break;
        case 'Error':
          setS((p) => ({ ...p, error: `${raw.code}: ${raw.message}` }));
          pendingRef.current?.reject(new Error(`${raw.code}: ${raw.message}`));
          pendingRef.current = null;
          break;
      }
    });

    sock.on('disconnect', () => {
      setS((p) => ({ ...p, phase: 'connecting' }));
    });

    return () => {
      sock.close();
      socketRef.current = null;
    };
  }, [serverUrl, bootMatchId]);

  const createMatch = useCallback(
    async (nickname: string) => {
      send({ kind: 'CreateMatch', nickname });
    },
    [send],
  );

  const joinMatch = useCallback(
    async (matchId: string, nickname: string) => {
      send({ kind: 'JoinMatch', matchId, nickname });
    },
    [send],
  );

  const submitDeck = useCallback(
    async (leaderCardId: string, deck: string[]) => {
      if (!s.matchId || !s.token) throw new Error('No active match');
      send({ kind: 'SubmitDeck', matchId: s.matchId, token: s.token, leaderCardId, deck });
    },
    [s.matchId, s.token, send],
  );

  const setReady = useCallback(
    async (ready: boolean) => {
      if (!s.matchId || !s.token) throw new Error('No active match');
      send({ kind: 'SetReady', matchId: s.matchId, token: s.token, ready });
    },
    [s.matchId, s.token, send],
  );

  const proposeAction = useCallback(
    async (action: Action) => {
      if (!s.matchId || !s.token) throw new Error('No active match');
      await sendExpectingState({
        kind: 'ProposeAction',
        matchId: s.matchId,
        token: s.token,
        action,
      });
    },
    [s.matchId, s.token, sendExpectingState],
  );

  const proposeActionBatch = useCallback(
    async (actions: Action[]) => {
      if (!s.matchId || !s.token) throw new Error('No active match');
      await sendExpectingState({
        kind: 'ProposeActionBatch',
        matchId: s.matchId,
        token: s.token,
        actions,
      });
    },
    [s.matchId, s.token, sendExpectingState],
  );

  const rematch = useCallback(
    async (ready: boolean) => {
      if (!s.matchId || !s.token) throw new Error('No active match');
      send({ kind: 'Rematch', matchId: s.matchId, token: s.token, ready });
    },
    [s.matchId, s.token, send],
  );

  const forfeit = useCallback(async () => {
    if (!s.matchId || !s.token) throw new Error('No active match');
    send({ kind: 'Forfeit', matchId: s.matchId, token: s.token });
  }, [s.matchId, s.token, send]);

  return {
    ...s,
    createMatch,
    joinMatch,
    submitDeck,
    setReady,
    proposeAction,
    proposeActionBatch,
    rematch,
    forfeit,
  };
}
