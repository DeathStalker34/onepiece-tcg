import { randomUUID } from 'node:crypto';
import type { CardStatic } from '@optcg/engine';
import { Match } from './match';
import { generateMatchCode } from './codes';

export interface MatchStoreOptions {
  cap?: number;
  gcIntervalMs?: number;
  finishedTtlMs?: number;
}

export class MatchStore {
  private readonly matches = new Map<string, Match>();
  private readonly cap: number;
  private readonly finishedTtlMs: number;
  private gcTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly catalog: Record<string, CardStatic>,
    opts: MatchStoreOptions = {},
  ) {
    this.cap = opts.cap ?? 500;
    this.finishedTtlMs = opts.finishedTtlMs ?? 2 * 60 * 60 * 1000;
    const gcInterval = opts.gcIntervalMs ?? 15 * 60 * 1000;
    if (gcInterval > 0) {
      this.gcTimer = setInterval(() => this.runGc(), gcInterval);
    }
  }

  create(hostNickname: string): { matchId: string; token: string } {
    if (this.matches.size >= this.cap) {
      throw new Error('ServerFull');
    }
    const token = randomUUID();
    const matchId = generateMatchCode((code) => this.matches.has(code));
    const match = new Match(matchId, token, hostNickname, this.catalog);
    this.matches.set(matchId, match);
    return { matchId, token };
  }

  get(matchId: string): Match | undefined {
    return this.matches.get(matchId);
  }

  delete(matchId: string): void {
    const m = this.matches.get(matchId);
    m?.cleanup();
    this.matches.delete(matchId);
  }

  runGc(): void {
    const cutoff = Date.now() - this.finishedTtlMs;
    for (const [id, m] of this.matches) {
      if (m.status === 'finished' && m.createdAt < cutoff) {
        this.delete(id);
      }
    }
  }

  shutdown(): void {
    if (this.gcTimer) clearInterval(this.gcTimer);
    for (const m of this.matches.values()) m.cleanup();
    this.matches.clear();
  }
}
