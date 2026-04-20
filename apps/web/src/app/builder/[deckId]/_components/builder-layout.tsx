'use client';

import { useEffect, useState } from 'react';
import type { Card } from '@optcg/card-data';
import { useUser } from '@/lib/user-context';

interface DeckDraftState {
  name: string;
  leaderCardId: string | null;
  cards: Array<{ cardId: string; quantity: number }>;
}

interface DeckApiResponse {
  id: string;
  name: string;
  leaderCardId: string | null;
  cards: Array<{ cardId: string; quantity: number }>;
}

export function BuilderLayout({ deckId }: { deckId: string }) {
  const { user, ready } = useUser();
  const [deck, setDeck] = useState<DeckDraftState | null>(null);
  const [catalog, setCatalog] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch(`/api/decks/${deckId}`, { headers: { 'x-user-id': user.id } }).then(
        (r) => r.json() as Promise<DeckApiResponse>,
      ),
      fetch('/api/cards').then((r) => r.json() as Promise<Card[]>),
    ])
      .then(([deckData, cardsData]) => {
        setDeck({
          name: deckData.name,
          leaderCardId: deckData.leaderCardId,
          cards: deckData.cards.map((c) => ({ cardId: c.cardId, quantity: c.quantity })),
        });
        setCatalog(cardsData);
      })
      .finally(() => setLoading(false));
  }, [deckId, user]);

  async function handleSave() {
    if (!user || !deck) return;
    setSaving(true);
    await fetch(`/api/decks/${deckId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-user-id': user.id },
      body: JSON.stringify({
        name: deck.name,
        leaderCardId: deck.leaderCardId,
        cards: deck.cards,
      }),
    });
    setSaving(false);
  }

  if (!ready) return null;
  if (!user) return null;
  if (loading) return <p className="p-6">Loading…</p>;
  if (!deck) return <p className="p-6 text-red-500">Deck not found</p>;

  const totalCards = deck.cards.reduce((s, c) => s + c.quantity, 0);

  return (
    <div className="flex gap-6 p-6">
      <aside className="w-56 shrink-0 space-y-4">
        <h2 className="text-sm font-semibold uppercase">Filters</h2>
        <p className="text-xs text-muted-foreground">(Filter UI — Task 10)</p>
      </aside>
      <main className="flex-1">
        <h2 className="mb-4 text-sm font-semibold uppercase">Card grid ({catalog.length})</h2>
        <p className="text-xs text-muted-foreground">(CardGridBuilder — Task 10)</p>
      </main>
      <aside className="w-80 shrink-0 space-y-4 rounded border p-4">
        <div className="flex items-center justify-between gap-2">
          <input
            className="flex-1 rounded border px-2 py-1 text-lg font-semibold"
            value={deck.name}
            onChange={(e) => setDeck({ ...deck, name: e.target.value })}
          />
          <button
            className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Leader: {deck.leaderCardId ?? 'none'} · {totalCards}/50
        </p>
        <p className="text-xs text-muted-foreground">(DeckPanel — Task 11)</p>
      </aside>
    </div>
  );
}
