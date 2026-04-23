import type { PlayerIndex } from '@optcg/engine';

export interface OnlineSession {
  token: string;
  nickname: string;
  playerIndex: PlayerIndex;
}

const sessionKey = (matchId: string): string => `optcg.online.session.${matchId}`;
const NICKNAME_KEY = 'optcg.online.nickname';

export function saveSession(matchId: string, session: OnlineSession): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(sessionKey(matchId), JSON.stringify(session));
}

export function loadSession(matchId: string): OnlineSession | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(sessionKey(matchId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OnlineSession;
    if (typeof parsed.token === 'string' && typeof parsed.nickname === 'string') return parsed;
    return null;
  } catch {
    return null;
  }
}

export function clearSession(matchId: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(sessionKey(matchId));
}

export function saveNickname(nickname: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(NICKNAME_KEY, nickname);
}

export function loadNickname(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(NICKNAME_KEY);
}
