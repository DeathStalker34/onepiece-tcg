/**
 * Build the URL for an API route hosted by the backend server (decks/users/games).
 * `/api/cards` stays in the Next.js app (reads cards.json) — don't use this for it.
 */
export function apiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3001';
  return `${base}${path}`;
}
