import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadSession,
  saveSession,
  clearSession,
  loadNickname,
  saveNickname,
} from './session-storage';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string): string | null {
    return this.store.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.store.set(k, v);
  }
  removeItem(k: string): void {
    this.store.delete(k);
  }
}

describe('online session storage', () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
  });

  it('round-trips a session', () => {
    saveSession('ABC123', { token: 't', nickname: 'Alice', playerIndex: 0 });
    const loaded = loadSession('ABC123');
    expect(loaded).toEqual({ token: 't', nickname: 'Alice', playerIndex: 0 });
  });

  it('returns null for unknown match', () => {
    expect(loadSession('XYZ999')).toBeNull();
  });

  it('clears a session', () => {
    saveSession('ABC123', { token: 't', nickname: 'A', playerIndex: 0 });
    clearSession('ABC123');
    expect(loadSession('ABC123')).toBeNull();
  });

  it('nickname persists', () => {
    saveNickname('Tiago');
    expect(loadNickname()).toBe('Tiago');
  });
});
