import type {
  Action,
  CardStatic,
  EngineError,
  GameEvent,
  GameState,
  PlayerIndex,
} from '@optcg/engine';
import { apply, createInitialState } from '@optcg/engine';
import type { GameOverReason, MatchStatus } from '@optcg/protocol';

export interface MatchPlayer {
  token: string;
  nickname: string;
  socketId: string | null;
  deck: { leaderCardId: string; cards: string[] } | null;
  ready: boolean;
}

export type OpResult<T = void> = { ok: true; value: T } | { ok: false; reason: EngineError };

function ok<T>(value: T): OpResult<T> {
  return { ok: true, value };
}

function errResult(code: string, detail?: string): OpResult<never> {
  return { ok: false, reason: { code, detail } as unknown as EngineError };
}

function validateDeckAgainstCatalog(
  leaderCardId: string,
  deck: string[],
  catalog: Record<string, CardStatic>,
): { ok: true } | { ok: false; reason: string } {
  const leader = catalog[leaderCardId];
  if (!leader) return { ok: false, reason: `Unknown leader ${leaderCardId}` };
  if (leader.type !== 'LEADER') return { ok: false, reason: `${leaderCardId} is not a LEADER` };
  if (deck.length !== 50)
    return { ok: false, reason: `Deck must have 50 cards, got ${deck.length}` };
  for (const id of deck) {
    if (!catalog[id]) return { ok: false, reason: `Unknown card ${id}` };
  }
  return { ok: true };
}

export class Match {
  status: MatchStatus = 'waiting';
  players: [MatchPlayer | null, MatchPlayer | null];
  state: GameState | null = null;
  createdAt = Date.now();
  private rngSeed: number;
  private nextFirstPlayer: PlayerIndex = Math.random() < 0.5 ? 0 : 1;
  private forfeitListener: ((winner: PlayerIndex, reason: GameOverReason) => void) | null = null;
  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    readonly id: string,
    hostToken: string,
    hostNickname: string,
    private catalog: Record<string, CardStatic>,
  ) {
    this.players = [
      { token: hostToken, nickname: hostNickname, socketId: null, deck: null, ready: false },
      null,
    ];
    this.rngSeed = Math.floor(Math.random() * 0x7fffffff);
  }

  join(token: string, nickname: string): OpResult {
    if (this.status !== 'waiting') return errResult('MatchUnavailable');
    this.players[1] = { token, nickname, socketId: null, deck: null, ready: false };
    this.status = 'lobby';
    return ok(undefined);
  }

  private playerByToken(token: string): { index: PlayerIndex; player: MatchPlayer } | null {
    if (this.players[0]?.token === token) return { index: 0, player: this.players[0] };
    if (this.players[1]?.token === token) return { index: 1, player: this.players[1] };
    return null;
  }

  submitDeck(token: string, leaderCardId: string, deck: string[]): OpResult {
    const p = this.playerByToken(token);
    if (!p) return errResult('Unauthorized');
    if (this.status !== 'lobby') return errResult('WrongPhase');
    const check = validateDeckAgainstCatalog(leaderCardId, deck, this.catalog);
    if (!check.ok) return errResult('DeckInvalid', check.reason);
    p.player.deck = { leaderCardId, cards: deck };
    p.player.ready = false;
    return ok(undefined);
  }

  setReady(token: string, ready: boolean): OpResult {
    const p = this.playerByToken(token);
    if (!p) return errResult('Unauthorized');
    if (this.status !== 'lobby') return errResult('WrongPhase');
    if (ready && !p.player.deck) return errResult('DeckInvalid', 'Submit deck before ready');
    p.player.ready = ready;

    const both = this.players[0]?.ready && this.players[1]?.ready;
    if (both && this.players[0]?.deck && this.players[1]?.deck) {
      this.startGame(this.nextFirstPlayer);
    }
    return ok(undefined);
  }

  private startGame(firstPlayer: PlayerIndex): void {
    const p0 = this.players[0]!;
    const p1 = this.players[1]!;
    this.state = createInitialState({
      seed: this.rngSeed,
      firstPlayer,
      players: [
        { playerId: p0.token, leaderCardId: p0.deck!.leaderCardId, deck: p0.deck!.cards },
        { playerId: p1.token, leaderCardId: p1.deck!.leaderCardId, deck: p1.deck!.cards },
      ],
      catalog: this.catalog,
    });
    this.status = 'playing';
    this.nextFirstPlayer = firstPlayer === 0 ? 1 : 0;
  }

  private actorIndex(state: GameState): PlayerIndex | null {
    const pw = state.priorityWindow;
    if (pw) {
      if (pw.kind === 'Mulligan') return pw.player;
      if (pw.kind === 'CounterStep') return pw.defender.owner;
      if (pw.kind === 'BlockerStep') return pw.originalTarget.owner;
      if (pw.kind === 'TriggerStep') return pw.owner;
    }
    return state.activePlayer;
  }

  proposeAction(
    token: string,
    action: Action,
  ): OpResult<{ state: GameState; events: GameEvent[] }> {
    const p = this.playerByToken(token);
    if (!p) return errResult('Unauthorized');
    if (this.status !== 'playing' || !this.state) return errResult('WrongPhase');
    const expected = this.actorIndex(this.state);
    if (expected !== p.index) return errResult('NotYourPriority');
    const result = apply(this.state, action);
    if (result.error) return { ok: false, reason: result.error };
    this.state = result.state;
    if (this.state.phase === 'GameOver' && this.state.winner !== null) {
      this.status = 'finished';
    }
    return ok({ state: this.state, events: result.events });
  }

  proposeActionBatch(
    token: string,
    actions: Action[],
  ): OpResult<{ state: GameState; events: GameEvent[] }> {
    const p = this.playerByToken(token);
    if (!p) return errResult('Unauthorized');
    if (this.status !== 'playing' || !this.state) return errResult('WrongPhase');
    const snapshot = this.state;
    let current = snapshot;
    const allEvents: GameEvent[] = [];
    for (let i = 0; i < actions.length; i += 1) {
      const expected = this.actorIndex(current);
      if (expected !== p.index) {
        this.state = snapshot;
        return {
          ok: false,
          reason: { code: 'NotYourPriority', detail: `index ${i}` } as unknown as EngineError,
        };
      }
      const result = apply(current, actions[i]);
      if (result.error) {
        this.state = snapshot;
        return { ok: false, reason: result.error };
      }
      current = result.state;
      allEvents.push(...result.events);
    }
    this.state = current;
    if (this.state.phase === 'GameOver' && this.state.winner !== null) {
      this.status = 'finished';
    }
    return ok({ state: this.state, events: allEvents });
  }

  forceFinish(winner: PlayerIndex, _reason: GameOverReason): void {
    this.status = 'finished';
    if (this.state) this.state = { ...this.state, winner, phase: 'GameOver' };
  }

  rematch(token: string, ready: boolean): OpResult {
    const p = this.playerByToken(token);
    if (!p) return errResult('Unauthorized');
    if (this.status !== 'finished') return errResult('WrongPhase');
    p.player.ready = ready;
    if (this.players[0]?.ready && this.players[1]?.ready) {
      this.rngSeed = Math.floor(Math.random() * 0x7fffffff);
      this.players[0]!.ready = false;
      this.players[1]!.ready = false;
      this.startGame(this.nextFirstPlayer);
    }
    return ok(undefined);
  }

  onForfeit(listener: (winner: PlayerIndex, reason: GameOverReason) => void): void {
    this.forfeitListener = listener;
  }

  handleDisconnect(token: string): void {
    const p = this.playerByToken(token);
    if (!p || this.status !== 'playing') return;
    p.player.socketId = null;
    const timer = setTimeout(() => {
      this.disconnectTimers.delete(token);
      if (this.status !== 'playing') return;
      const winner: PlayerIndex = p.index === 0 ? 1 : 0;
      this.forceFinish(winner, 'timeout');
      this.forfeitListener?.(winner, 'timeout');
    }, 60_000);
    this.disconnectTimers.set(token, timer);
  }

  handleReconnect(token: string, socketId: string): OpResult<{ state: GameState | null }> {
    const p = this.playerByToken(token);
    if (!p) return errResult('Unauthorized');
    const timer = this.disconnectTimers.get(token);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(token);
    }
    p.player.socketId = socketId;
    return ok({ state: this.state });
  }

  forfeit(token: string): OpResult {
    const p = this.playerByToken(token);
    if (!p) return errResult('Unauthorized');
    if (this.status !== 'playing') return errResult('WrongPhase');
    const winner: PlayerIndex = p.index === 0 ? 1 : 0;
    this.forceFinish(winner, 'forfeit');
    this.forfeitListener?.(winner, 'forfeit');
    return ok(undefined);
  }

  cleanup(): void {
    for (const t of this.disconnectTimers.values()) clearTimeout(t);
    this.disconnectTimers.clear();
  }
}
