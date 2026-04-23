import { randomUUID } from 'node:crypto';
import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { ServerMsg } from '@optcg/protocol';
import type { Action, EngineError, GameEvent, PlayerIndex } from '@optcg/engine';
import { clientMsgSchema } from '../protocol/schemas';
import { filterStateForPlayer } from '../protocol/filter';
import type { Match } from './match';
import type { MatchStore } from './store';

const ROOM = (id: string): string => `match:${id}`;

function errorMessage(e: EngineError): string {
  const rec = e as unknown as Record<string, unknown>;
  if (typeof rec.detail === 'string') return rec.detail;
  if (typeof rec.reason === 'string') return rec.reason;
  return '';
}

function toLobbyUpdate(match: Match): Extract<ServerMsg, { kind: 'LobbyUpdate' }> {
  return {
    kind: 'LobbyUpdate',
    players: match.players.map((p) =>
      p ? { nickname: p.nickname, deckReady: Boolean(p.deck), ready: p.ready } : null,
    ),
    matchStatus: match.status,
  };
}

function broadcastStateUpdate(io: SocketIOServer, match: Match, events: GameEvent[]): void {
  if (!match.state) return;
  for (const i of [0, 1] as const) {
    const player = match.players[i];
    if (!player?.socketId) continue;
    const msg: ServerMsg = {
      kind: 'StateUpdate',
      state: filterStateForPlayer(match.state, i),
      events,
    };
    io.to(player.socketId).emit('msg', msg);
  }
}

function broadcastGameStart(io: SocketIOServer, match: Match): void {
  if (!match.state) return;
  for (const i of [0, 1] as const) {
    const player = match.players[i];
    if (!player?.socketId) continue;
    const msg: ServerMsg = {
      kind: 'GameStart',
      firstPlayer: match.state.activePlayer,
      initialState: filterStateForPlayer(match.state, i),
    };
    io.to(player.socketId).emit('msg', msg);
  }
}

function broadcastGameOver(
  io: SocketIOServer,
  match: Match,
  winner: PlayerIndex,
  reason: 'engine' | 'forfeit' | 'timeout',
): void {
  const msg: ServerMsg = { kind: 'GameOver', winner, reason };
  io.to(ROOM(match.id)).emit('msg', msg);
}

function send(socket: Socket, msg: ServerMsg): void {
  socket.emit('msg', msg);
}

export function registerHandlers(io: SocketIOServer, store: MatchStore): void {
  io.on('connection', (socket) => {
    const sessions = new Map<string, { matchId: string; playerIndex: PlayerIndex }>();

    socket.on('msg', (raw: unknown) => {
      const parsed = clientMsgSchema.safeParse(raw);
      if (!parsed.success) {
        send(socket, { kind: 'Error', code: 'BadRequest', message: parsed.error.message });
        return;
      }
      const msg = parsed.data;

      if (msg.kind === 'CreateMatch') {
        try {
          const { matchId, token } = store.create(msg.nickname);
          const match = store.get(matchId)!;
          match.players[0]!.socketId = socket.id;
          sessions.set(token, { matchId, playerIndex: 0 });
          socket.join(ROOM(matchId));
          match.onForfeit((winner, reason) => broadcastGameOver(io, match, winner, reason));
          send(socket, { kind: 'MatchCreated', matchId, token, playerIndex: 0 });
        } catch (e) {
          send(socket, { kind: 'Error', code: 'ServerFull', message: (e as Error).message });
        }
        return;
      }

      if (msg.kind === 'JoinMatch') {
        const match = store.get(msg.matchId);
        if (!match) {
          send(socket, { kind: 'Error', code: 'MatchNotFound', message: msg.matchId });
          return;
        }
        const token = randomUUID();
        const r = match.join(token, msg.nickname);
        if (!r.ok) {
          send(socket, {
            kind: 'Error',
            code: r.reason.code,
            message: errorMessage(r.reason),
          });
          return;
        }
        match.players[1]!.socketId = socket.id;
        sessions.set(token, { matchId: msg.matchId, playerIndex: 1 });
        socket.join(ROOM(msg.matchId));
        send(socket, { kind: 'MatchJoined', matchId: msg.matchId, token, playerIndex: 1 });
        io.to(ROOM(msg.matchId)).emit('msg', toLobbyUpdate(match));
        return;
      }

      // Remaining messages require matchId + token (guaranteed by zod schema discrimination).
      const match = store.get(msg.matchId);
      if (!match) {
        send(socket, { kind: 'Error', code: 'MatchNotFound', message: msg.matchId });
        return;
      }

      if (msg.kind === 'SubmitDeck') {
        const r = match.submitDeck(msg.token, msg.leaderCardId, msg.deck);
        if (!r.ok) {
          send(socket, {
            kind: 'Error',
            code: r.reason.code,
            message: errorMessage(r.reason),
          });
          return;
        }
        io.to(ROOM(msg.matchId)).emit('msg', toLobbyUpdate(match));
        return;
      }

      if (msg.kind === 'SetReady') {
        const prevStatus = match.status;
        const r = match.setReady(msg.token, msg.ready);
        if (!r.ok) {
          send(socket, {
            kind: 'Error',
            code: r.reason.code,
            message: errorMessage(r.reason),
          });
          return;
        }
        io.to(ROOM(msg.matchId)).emit('msg', toLobbyUpdate(match));
        if (prevStatus !== 'playing' && match.status === 'playing') {
          broadcastGameStart(io, match);
        }
        return;
      }

      if (msg.kind === 'ProposeAction') {
        const r = match.proposeAction(msg.token, msg.action as unknown as Action);
        if (!r.ok) {
          send(socket, { kind: 'ActionRejected', reason: r.reason });
          return;
        }
        broadcastStateUpdate(io, match, r.value.events);
        if (match.status === 'finished' && match.state && match.state.winner !== null) {
          broadcastGameOver(io, match, match.state.winner, 'engine');
        }
        return;
      }

      if (msg.kind === 'ProposeActionBatch') {
        const r = match.proposeActionBatch(msg.token, msg.actions as unknown as Action[]);
        if (!r.ok) {
          send(socket, { kind: 'ActionRejected', reason: r.reason });
          return;
        }
        broadcastStateUpdate(io, match, r.value.events);
        if (match.status === 'finished' && match.state && match.state.winner !== null) {
          broadcastGameOver(io, match, match.state.winner, 'engine');
        }
        return;
      }

      if (msg.kind === 'Reconnect') {
        const r = match.handleReconnect(msg.token, socket.id);
        if (!r.ok) {
          send(socket, {
            kind: 'Error',
            code: r.reason.code,
            message: errorMessage(r.reason),
          });
          return;
        }
        socket.join(ROOM(msg.matchId));
        const idx: PlayerIndex = match.players[0]?.token === msg.token ? 0 : 1;
        sessions.set(msg.token, { matchId: msg.matchId, playerIndex: idx });
        const opp = match.players[idx === 0 ? 1 : 0];
        if (opp?.socketId) {
          io.to(opp.socketId).emit('msg', { kind: 'OpponentReconnected' });
        }
        if (match.state) {
          send(socket, {
            kind: 'StateUpdate',
            state: filterStateForPlayer(match.state, idx),
            events: [],
          });
        } else {
          send(socket, toLobbyUpdate(match));
        }
        return;
      }

      if (msg.kind === 'Rematch') {
        const prev = match.status;
        const r = match.rematch(msg.token, msg.ready);
        if (!r.ok) {
          send(socket, {
            kind: 'Error',
            code: r.reason.code,
            message: errorMessage(r.reason),
          });
          return;
        }
        if (prev === 'finished' && match.status === 'playing') {
          broadcastGameStart(io, match);
        }
        return;
      }

      if (msg.kind === 'Forfeit') {
        const r = match.forfeit(msg.token);
        if (!r.ok) {
          send(socket, {
            kind: 'Error',
            code: r.reason.code,
            message: errorMessage(r.reason),
          });
        }
        return;
      }
    });

    socket.on('disconnect', () => {
      for (const [token, s] of sessions) {
        const match = store.get(s.matchId);
        if (!match) continue;
        match.handleDisconnect(token);
        const opp = match.players[s.playerIndex === 0 ? 1 : 0];
        if (opp?.socketId) {
          io.to(opp.socketId).emit('msg', {
            kind: 'OpponentDisconnected',
            secondsToForfeit: 60,
          });
        }
      }
    });
  });
}
