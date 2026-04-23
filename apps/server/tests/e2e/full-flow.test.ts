import { describe, it, expect, afterEach } from 'vitest';
import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, type Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import { MatchStore } from '../../src/match/store';
import { registerHandlers } from '../../src/match/handlers';
import type { ServerMsg } from '@optcg/protocol';
import { CATALOG } from '../match/fixtures';

function waitForKind(sock: Socket, kind: ServerMsg['kind']): Promise<ServerMsg> {
  return new Promise((resolve) => {
    const fn = (m: ServerMsg): void => {
      if (m.kind === kind) {
        sock.off('msg', fn);
        resolve(m);
      }
    };
    sock.on('msg', fn);
  });
}

describe('e2e full online flow', () => {
  const teardown: Array<() => void | Promise<void>> = [];
  afterEach(async () => {
    for (const t of teardown.reverse()) await t();
    teardown.length = 0;
  });

  it('2 clients complete GameStart with filtered state', async () => {
    const httpServer = createServer();
    const io = new SocketIOServer(httpServer);
    const store = new MatchStore(CATALOG, { cap: 10, gcIntervalMs: 0 });
    registerHandlers(io, store);
    await new Promise<void>((r) => httpServer.listen(0, r));
    const port = (httpServer.address() as AddressInfo).port;
    teardown.push(
      () =>
        new Promise<void>((r) => {
          io.close();
          httpServer.close(() => r());
        }),
    );
    teardown.push(() => void store.shutdown());

    const host = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
      reconnection: false,
    });
    const guest = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
      reconnection: false,
    });
    teardown.push(() => void host.close());
    teardown.push(() => void guest.close());
    await Promise.all([
      new Promise<void>((r) => host.on('connect', () => r())),
      new Promise<void>((r) => guest.on('connect', () => r())),
    ]);

    host.emit('msg', { kind: 'CreateMatch', nickname: 'A' });
    const created = (await waitForKind(host, 'MatchCreated')) as Extract<
      ServerMsg,
      { kind: 'MatchCreated' }
    >;

    guest.emit('msg', { kind: 'JoinMatch', matchId: created.matchId, nickname: 'B' });
    const joined = (await waitForKind(guest, 'MatchJoined')) as Extract<
      ServerMsg,
      { kind: 'MatchJoined' }
    >;

    const deck = Array(50).fill('OP01-006');
    host.emit('msg', {
      kind: 'SubmitDeck',
      matchId: created.matchId,
      token: created.token,
      leaderCardId: 'OP01-001',
      deck,
    });
    guest.emit('msg', {
      kind: 'SubmitDeck',
      matchId: created.matchId,
      token: joined.token,
      leaderCardId: 'OP01-001',
      deck,
    });

    const hostStart = waitForKind(host, 'GameStart');
    const guestStart = waitForKind(guest, 'GameStart');
    host.emit('msg', {
      kind: 'SetReady',
      matchId: created.matchId,
      token: created.token,
      ready: true,
    });
    guest.emit('msg', {
      kind: 'SetReady',
      matchId: created.matchId,
      token: joined.token,
      ready: true,
    });
    const [gs] = await Promise.all([hostStart, guestStart]);
    expect(gs.kind).toBe('GameStart');

    const start = gs as Extract<ServerMsg, { kind: 'GameStart' }>;
    expect(start.initialState.players[1].hand.every((c) => c === '__hidden__')).toBe(true);
  });
});
