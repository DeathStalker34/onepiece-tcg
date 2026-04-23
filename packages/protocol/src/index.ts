import type { Action, EngineError, GameEvent, GameState, PlayerIndex } from '@optcg/engine';

export type MatchStatus = 'waiting' | 'lobby' | 'playing' | 'finished';
export type GameOverReason = 'engine' | 'forfeit' | 'timeout';

export interface LobbyPlayer {
  nickname: string;
  deckReady: boolean;
  ready: boolean;
}

export type ClientMsg =
  | { kind: 'CreateMatch'; nickname: string }
  | { kind: 'JoinMatch'; matchId: string; nickname: string }
  | {
      kind: 'SubmitDeck';
      matchId: string;
      token: string;
      leaderCardId: string;
      deck: string[];
    }
  | { kind: 'SetReady'; matchId: string; token: string; ready: boolean }
  | { kind: 'ProposeAction'; matchId: string; token: string; action: Action }
  | { kind: 'ProposeActionBatch'; matchId: string; token: string; actions: Action[] }
  | { kind: 'Reconnect'; matchId: string; token: string }
  | { kind: 'Rematch'; matchId: string; token: string; ready: boolean }
  | { kind: 'Forfeit'; matchId: string; token: string };

export type ServerMsg =
  | { kind: 'MatchCreated'; matchId: string; token: string; playerIndex: 0 }
  | { kind: 'MatchJoined'; matchId: string; token: string; playerIndex: 1 }
  | {
      kind: 'LobbyUpdate';
      players: (LobbyPlayer | null)[];
      matchStatus: MatchStatus;
    }
  | { kind: 'GameStart'; firstPlayer: PlayerIndex; initialState: GameState }
  | { kind: 'StateUpdate'; state: GameState; events: GameEvent[] }
  | { kind: 'ActionRejected'; reason: EngineError; batchIndex?: number }
  | { kind: 'OpponentDisconnected'; secondsToForfeit: number }
  | { kind: 'OpponentReconnected' }
  | { kind: 'GameOver'; winner: PlayerIndex; reason: GameOverReason }
  | { kind: 'Error'; code: string; message: string };

export const HIDDEN_CARD_ID = '__hidden__' as const;
