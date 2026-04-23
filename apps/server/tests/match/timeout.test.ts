import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Match } from '../../src/match/match';
import { CATALOG, validDeck } from './fixtures';

function setupPlaying(): Match {
  const m = new Match('ABC123', 'host-token', 'Alice', CATALOG);
  m.join('guest-token', 'Bob');
  m.submitDeck('host-token', 'OP01-001', validDeck());
  m.submitDeck('guest-token', 'OP01-001', validDeck());
  m.setReady('host-token', true);
  m.setReady('guest-token', true);
  return m;
}

describe('Match disconnect/reconnect', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('disconnect starts a 60s timer', () => {
    const m = setupPlaying();
    const onForfeit = vi.fn();
    m.onForfeit(onForfeit);
    m.handleDisconnect('host-token');
    vi.advanceTimersByTime(59_000);
    expect(onForfeit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(onForfeit).toHaveBeenCalledWith(1, 'timeout');
  });

  it('reconnect cancels the timer', () => {
    const m = setupPlaying();
    const onForfeit = vi.fn();
    m.onForfeit(onForfeit);
    m.handleDisconnect('host-token');
    vi.advanceTimersByTime(30_000);
    m.handleReconnect('host-token', 'new-socket');
    vi.advanceTimersByTime(60_000);
    expect(onForfeit).not.toHaveBeenCalled();
  });

  it('forfeit explicit triggers onForfeit immediately', () => {
    const m = setupPlaying();
    const onForfeit = vi.fn();
    m.onForfeit(onForfeit);
    m.forfeit('guest-token');
    expect(onForfeit).toHaveBeenCalledWith(0, 'forfeit');
  });
});
