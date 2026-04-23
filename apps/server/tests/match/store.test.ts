import { describe, it, expect } from 'vitest';
import { MatchStore } from '../../src/match/store';
import { CATALOG } from './fixtures';

describe('MatchStore', () => {
  it('creates match with unique id', () => {
    const store = new MatchStore(CATALOG, { cap: 10, gcIntervalMs: 0 });
    const { matchId, token } = store.create('Alice');
    expect(matchId).toMatch(/^[A-Z0-9]{6}$/);
    expect(token.length).toBeGreaterThan(10);
    expect(store.get(matchId)).toBeDefined();
    store.shutdown();
  });

  it('rejects create when at cap', () => {
    const store = new MatchStore(CATALOG, { cap: 2, gcIntervalMs: 0 });
    store.create('A');
    store.create('B');
    expect(() => store.create('C')).toThrow(/ServerFull/i);
    store.shutdown();
  });

  it('GC removes finished matches older than 2h', () => {
    const store = new MatchStore(CATALOG, { cap: 10, gcIntervalMs: 0 });
    const { matchId } = store.create('Alice');
    const match = store.get(matchId)!;
    (match as unknown as { status: string }).status = 'finished';
    (match as unknown as { createdAt: number }).createdAt = Date.now() - 3 * 60 * 60 * 1000;
    store.runGc();
    expect(store.get(matchId)).toBeUndefined();
    store.shutdown();
  });
});
