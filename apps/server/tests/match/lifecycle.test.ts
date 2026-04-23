import { describe, it, expect } from 'vitest';
import { Match } from '../../src/match/match';
import { CATALOG, validDeck } from './fixtures';

describe('Match lifecycle', () => {
  it('starts in waiting with only host', () => {
    const m = new Match('ABC123', 'host-token', 'Alice', CATALOG);
    expect(m.status).toBe('waiting');
    expect(m.players[0]?.nickname).toBe('Alice');
    expect(m.players[1]).toBeNull();
  });

  it('moves to lobby when guest joins', () => {
    const m = new Match('ABC123', 'host-token', 'Alice', CATALOG);
    const joined = m.join('guest-token', 'Bob');
    expect(joined.ok).toBe(true);
    expect(m.status).toBe('lobby');
    expect(m.players[1]?.nickname).toBe('Bob');
  });

  it('rejects second join', () => {
    const m = new Match('ABC123', 'host-token', 'Alice', CATALOG);
    m.join('guest-token', 'Bob');
    const r = m.join('third-token', 'Charlie');
    expect(r.ok).toBe(false);
  });

  it('SubmitDeck validates and stores', () => {
    const m = new Match('ABC123', 'host-token', 'Alice', CATALOG);
    m.join('guest-token', 'Bob');
    const r = m.submitDeck('host-token', 'OP01-001', validDeck());
    expect(r.ok).toBe(true);
    expect(m.players[0]?.deck).not.toBeNull();
  });

  it('SubmitDeck rejects invalid count', () => {
    const m = new Match('ABC123', 'host-token', 'Alice', CATALOG);
    m.join('guest-token', 'Bob');
    const r = m.submitDeck('host-token', 'OP01-001', Array(40).fill('OP01-006'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.code).toBe('DeckInvalid');
  });

  it('starts playing when both ready with decks', () => {
    const m = new Match('ABC123', 'host-token', 'Alice', CATALOG);
    m.join('guest-token', 'Bob');
    m.submitDeck('host-token', 'OP01-001', validDeck());
    m.submitDeck('guest-token', 'OP01-001', validDeck());
    m.setReady('host-token', true);
    const start = m.setReady('guest-token', true);
    expect(start.ok).toBe(true);
    expect(m.status).toBe('playing');
    expect(m.state).not.toBeNull();
  });

  it('rejects SetReady(true) without submitted deck', () => {
    const m = new Match('ABC123', 'host-token', 'Alice', CATALOG);
    m.join('guest-token', 'Bob');
    const r = m.setReady('host-token', true);
    expect(r.ok).toBe(false);
  });

  it('ProposeAction rejects wrong-token', () => {
    const m = new Match('ABC123', 'host-token', 'Alice', CATALOG);
    m.join('guest-token', 'Bob');
    m.submitDeck('host-token', 'OP01-001', validDeck());
    m.submitDeck('guest-token', 'OP01-001', validDeck());
    m.setReady('host-token', true);
    m.setReady('guest-token', true);
    const firstPlayer = m.state!.activePlayer;
    const wrongToken = firstPlayer === 0 ? 'guest-token' : 'host-token';
    const r = m.proposeAction(wrongToken, {
      kind: 'Mulligan',
      player: firstPlayer,
      mulligan: false,
    });
    expect(r.ok).toBe(false);
  });

  it('ProposeAction accepts correct token and updates state', () => {
    const m = new Match('ABC123', 'host-token', 'Alice', CATALOG);
    m.join('guest-token', 'Bob');
    m.submitDeck('host-token', 'OP01-001', validDeck());
    m.submitDeck('guest-token', 'OP01-001', validDeck());
    m.setReady('host-token', true);
    m.setReady('guest-token', true);
    const firstPlayer = m.state!.activePlayer;
    const firstToken = firstPlayer === 0 ? 'host-token' : 'guest-token';
    const r = m.proposeAction(firstToken, {
      kind: 'Mulligan',
      player: firstPlayer,
      mulligan: false,
    });
    expect(r.ok).toBe(true);
  });

  it('rematch flips firstPlayer', () => {
    const m = new Match('ABC123', 'host-token', 'Alice', CATALOG);
    m.join('guest-token', 'Bob');
    m.submitDeck('host-token', 'OP01-001', validDeck());
    m.submitDeck('guest-token', 'OP01-001', validDeck());
    m.setReady('host-token', true);
    m.setReady('guest-token', true);
    const firstBefore = m.state!.activePlayer;
    m.forceFinish(firstBefore === 0 ? 1 : 0, 'forfeit');
    m.rematch('host-token', true);
    m.rematch('guest-token', true);
    expect(m.status).toBe('playing');
    expect(m.state!.activePlayer).not.toBe(firstBefore);
  });
});
