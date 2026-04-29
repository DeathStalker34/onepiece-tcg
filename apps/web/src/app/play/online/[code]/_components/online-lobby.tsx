'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/lib/user-context';
import { apiUrl } from '@/lib/api';
import type { OnlineHook } from '@/lib/online/use-online-socket';

interface DeckSummary {
  id: string;
  name: string;
  leaderCardId: string | null;
  cards: Array<{ cardId: string; quantity: number }>;
}

function expandDeck(cards: Array<{ cardId: string; quantity: number }>): string[] {
  const out: string[] = [];
  for (const c of cards) for (let i = 0; i < c.quantity; i += 1) out.push(c.cardId);
  return out;
}

export function OnlineLobby({ online, matchId }: { online: OnlineHook; matchId: string }) {
  const { user } = useUser();
  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch(apiUrl('/api/decks'), { headers: { 'x-user-id': user.id } })
      .then((r) => (r.ok ? r.json() : []))
      .then(setDecks)
      .catch(() => setDecks([]));
  }, [user]);

  const myIndex = online.playerIndex;
  const me = myIndex !== null && online.lobby ? online.lobby.players[myIndex] : null;
  const oppIndex = myIndex === 0 ? 1 : 0;
  const opp = myIndex !== null && online.lobby ? online.lobby.players[oppIndex] : null;

  function handleSubmitDeck(): void {
    if (!selectedDeck || !decks) return;
    const deck = decks.find((d) => d.id === selectedDeck);
    if (!deck || !deck.leaderCardId) return;
    const expanded = expandDeck(deck.cards);
    if (expanded.length !== 50) return;
    void online.submitDeck(deck.leaderCardId, expanded);
  }

  function handleReady(next: boolean): void {
    void online.setReady(next);
  }

  const shareUrl =
    typeof window === 'undefined' ? '' : `${window.location.origin}/play/online/${matchId}`;

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <div>
        <h1 className="text-xl font-semibold">Lobby — {matchId}</h1>
        <p className="text-sm text-muted-foreground">
          Share this code or URL with your opponent:
          <br />
          <code className="select-all">{shareUrl}</code>
        </p>
      </div>

      {!opp && <p className="text-sm italic">Waiting for opponent…</p>}

      {opp && (
        <div className="rounded border p-3 text-sm">
          <div>
            <strong>Opponent:</strong> {opp.nickname} · deck {opp.deckReady ? '✓' : '…'} · ready{' '}
            {opp.ready ? '✓' : '…'}
          </div>
          <div>
            <strong>You:</strong> {me?.nickname ?? '—'} · deck {me?.deckReady ? '✓' : '…'} · ready{' '}
            {me?.ready ? '✓' : '…'}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-semibold">Pick your deck</h2>
        {decks === null && <p>Loading decks…</p>}
        {decks && decks.length === 0 && <p>No decks found. Create one in the builder first.</p>}
        {decks && decks.length > 0 && (
          <select
            className="w-full rounded border p-2"
            value={selectedDeck ?? ''}
            onChange={(e) => setSelectedDeck(e.target.value || null)}
          >
            <option value="">—</option>
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}
        <Button onClick={handleSubmitDeck} disabled={!selectedDeck}>
          Submit deck
        </Button>
      </div>

      <div>
        <Button
          onClick={() => handleReady(!me?.ready)}
          disabled={!me?.deckReady || !opp}
          variant={me?.ready ? 'secondary' : 'default'}
        >
          {me?.ready ? 'Cancel ready' : 'Ready'}
        </Button>
      </div>

      {online.error && <p className="text-sm text-red-500">{online.error}</p>}
    </main>
  );
}
