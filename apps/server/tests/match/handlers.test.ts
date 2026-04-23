import { describe, it, expect, afterEach } from 'vitest';
import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, type Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import { MatchStore } from '../../src/match/store';
import { registerHandlers } from '../../src/match/handlers';
import type { ServerMsg } from '@optcg/protocol';
import { CATALOG } from './fixtures';

function setupServer() {
  const httpServer = createServer();
  const io = new SocketIOServer(httpServer);
  const store = new MatchStore(CATALOG, { cap: 10, gcIntervalMs: 0 });
  registerHandlers(io, store);
  return { httpServer, io, store };
}

async function connect(url: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = ioClient(url, { transports: ['websocket'], reconnection: false });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

function waitFor(socket: Socket, kind: ServerMsg['kind']): Promise<ServerMsg> {
  return new Promise((resolve) => {
    const handler = (m: ServerMsg): void => {
      if (m.kind === kind) {
        socket.off('msg', handler);
        resolve(m);
      }
    };
    socket.on('msg', handler);
  });
}

describe('socket handlers', () => {
  let teardown: Array<() => void | Promise<void>> = [];

  afterEach(async () => {
    for (const t of teardown.reverse()) await t();
    teardown = [];
  });

  it('CreateMatch + JoinMatch → both receive LobbyUpdate', async () => {
    const { httpServer, io, store } = setupServer();
    await new Promise<void>((r) => httpServer.listen(0, r));
    teardown.push(
      () =>
        new Promise<void>((r) => {
          io.close();
          httpServer.close(() => r());
        }),
    );
    teardown.push(() => void store.shutdown());
    const port = (httpServer.address() as AddressInfo).port;

    const host = await connect(`http://localhost:${port}`);
    teardown.push(() => void host.close());

    host.emit('msg', { kind: 'CreateMatch', nickname: 'Alice' });
    const created = (await waitFor(host, 'MatchCreated')) as Extract<
      ServerMsg,
      { kind: 'MatchCreated' }
    >;
    expect(created.matchId).toMatch(/^[A-Z0-9]{6}$/);

    const guest = await connect(`http://localhost:${port}`);
    teardown.push(() => void guest.close());
    const guestLobby = waitFor(guest, 'LobbyUpdate');
    const hostLobby = waitFor(host, 'LobbyUpdate');
    guest.emit('msg', { kind: 'JoinMatch', matchId: created.matchId, nickname: 'Bob' });
    const [gL, hL] = await Promise.all([guestLobby, hostLobby]);
    expect(gL.kind).toBe('LobbyUpdate');
    expect(hL.kind).toBe('LobbyUpdate');
  });

  it('full play flow: SubmitDeck + SetReady + ProposeAction → StateUpdate', async () => {
    const { httpServer, io, store } = setupServer();
    await new Promise<void>((r) => httpServer.listen(0, r));
    teardown.push(
      () =>
        new Promise<void>((r) => {
          io.close();
          httpServer.close(() => r());
        }),
    );
    teardown.push(() => void store.shutdown());
    const port = (httpServer.address() as AddressInfo).port;

    const host = await connect(`http://localhost:${port}`);
    teardown.push(() => void host.close());
    const guest = await connect(`http://localhost:${port}`);
    teardown.push(() => void guest.close());

    host.emit('msg', { kind: 'CreateMatch', nickname: 'Alice' });
    const created = (await waitFor(host, 'MatchCreated')) as Extract<
      ServerMsg,
      { kind: 'MatchCreated' }
    >;

    guest.emit('msg', { kind: 'JoinMatch', matchId: created.matchId, nickname: 'Bob' });
    const joined = (await waitFor(guest, 'MatchJoined')) as Extract<
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

    const hostStart = waitFor(host, 'GameStart');
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
    const gs = (await hostStart) as Extract<ServerMsg, { kind: 'GameStart' }>;
    const firstPlayer = gs.firstPlayer;
    const firstSocket = firstPlayer === 0 ? host : guest;
    const firstToken = firstPlayer === 0 ? created.token : joined.token;

    const stateUpdate = waitFor(firstSocket, 'StateUpdate');
    firstSocket.emit('msg', {
      kind: 'ProposeAction',
      matchId: created.matchId,
      token: firstToken,
      action: { kind: 'Mulligan', player: firstPlayer, mulligan: false },
    });
    const update = await stateUpdate;
    expect(update.kind).toBe('StateUpdate');
  });

  it('SubmitDeck with invalid leader returns Error', async () => {
    const { httpServer, io, store } = setupServer();
    await new Promise<void>((r) => httpServer.listen(0, r));
    teardown.push(
      () =>
        new Promise<void>((r) => {
          io.close();
          httpServer.close(() => r());
        }),
    );
    teardown.push(() => void store.shutdown());
    const port = (httpServer.address() as AddressInfo).port;

    const host = await connect(`http://localhost:${port}`);
    teardown.push(() => void host.close());
    const guest = await connect(`http://localhost:${port}`);
    teardown.push(() => void guest.close());

    host.emit('msg', { kind: 'CreateMatch', nickname: 'A' });
    const created = (await waitFor(host, 'MatchCreated')) as Extract<
      ServerMsg,
      { kind: 'MatchCreated' }
    >;
    guest.emit('msg', { kind: 'JoinMatch', matchId: created.matchId, nickname: 'B' });
    await waitFor(guest, 'MatchJoined');

    host.emit('msg', {
      kind: 'SubmitDeck',
      matchId: created.matchId,
      token: created.token,
      leaderCardId: 'UNKNOWN-999',
      deck: Array(50).fill('OP01-006'),
    });
    const err = (await waitFor(host, 'Error')) as Extract<ServerMsg, { kind: 'Error' }>;
    expect(err.code).toBe('DeckInvalid');
  });

  it('Forfeit triggers GameOver for both', async () => {
    const { httpServer, io, store } = setupServer();
    await new Promise<void>((r) => httpServer.listen(0, r));
    teardown.push(
      () =>
        new Promise<void>((r) => {
          io.close();
          httpServer.close(() => r());
        }),
    );
    teardown.push(() => void store.shutdown());
    const port = (httpServer.address() as AddressInfo).port;

    const host = await connect(`http://localhost:${port}`);
    teardown.push(() => void host.close());
    const guest = await connect(`http://localhost:${port}`);
    teardown.push(() => void guest.close());

    host.emit('msg', { kind: 'CreateMatch', nickname: 'A' });
    const created = (await waitFor(host, 'MatchCreated')) as Extract<
      ServerMsg,
      { kind: 'MatchCreated' }
    >;
    guest.emit('msg', { kind: 'JoinMatch', matchId: created.matchId, nickname: 'B' });
    const joined = (await waitFor(guest, 'MatchJoined')) as Extract<
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
    await waitFor(host, 'GameStart');

    const hostOver = waitFor(host, 'GameOver');
    const guestOver = waitFor(guest, 'GameOver');
    host.emit('msg', { kind: 'Forfeit', matchId: created.matchId, token: created.token });
    const [hO, gO] = await Promise.all([hostOver, guestOver]);
    expect((hO as Extract<ServerMsg, { kind: 'GameOver' }>).reason).toBe('forfeit');
    expect((gO as Extract<ServerMsg, { kind: 'GameOver' }>).winner).toBe(1);
  });

  it('Reconnect replays last StateUpdate', async () => {
    const { httpServer, io, store } = setupServer();
    await new Promise<void>((r) => httpServer.listen(0, r));
    teardown.push(
      () =>
        new Promise<void>((r) => {
          io.close();
          httpServer.close(() => r());
        }),
    );
    teardown.push(() => void store.shutdown());
    const port = (httpServer.address() as AddressInfo).port;

    const host = await connect(`http://localhost:${port}`);
    teardown.push(() => void host.close());
    const guest = await connect(`http://localhost:${port}`);
    teardown.push(() => void guest.close());

    host.emit('msg', { kind: 'CreateMatch', nickname: 'A' });
    const created = (await waitFor(host, 'MatchCreated')) as Extract<
      ServerMsg,
      { kind: 'MatchCreated' }
    >;
    guest.emit('msg', { kind: 'JoinMatch', matchId: created.matchId, nickname: 'B' });
    const joined = (await waitFor(guest, 'MatchJoined')) as Extract<
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
    await waitFor(host, 'GameStart');

    // Host reconnects using same token — should receive StateUpdate.
    const stateOnReconnect = waitFor(host, 'StateUpdate');
    host.emit('msg', {
      kind: 'Reconnect',
      matchId: created.matchId,
      token: created.token,
    });
    const update = await stateOnReconnect;
    expect(update.kind).toBe('StateUpdate');
  });

  it('rejects ProposeAction with Unauthorized token', async () => {
    const { httpServer, io, store } = setupServer();
    await new Promise<void>((r) => httpServer.listen(0, r));
    teardown.push(
      () =>
        new Promise<void>((r) => {
          io.close();
          httpServer.close(() => r());
        }),
    );
    teardown.push(() => void store.shutdown());
    const port = (httpServer.address() as AddressInfo).port;

    const host = await connect(`http://localhost:${port}`);
    teardown.push(() => void host.close());
    host.emit('msg', { kind: 'CreateMatch', nickname: 'Alice' });
    const created = (await waitFor(host, 'MatchCreated')) as Extract<
      ServerMsg,
      { kind: 'MatchCreated' }
    >;

    host.emit('msg', {
      kind: 'ProposeAction',
      matchId: created.matchId,
      token: 'wrong-token-abc',
      action: { kind: 'EndTurn', player: 0 },
    });
    const rejected = await waitFor(host, 'ActionRejected');
    expect(rejected.kind).toBe('ActionRejected');
  });
});
