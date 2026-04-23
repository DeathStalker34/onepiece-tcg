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
