'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/lib/user-context';
import { apiUrl } from '@/lib/api';
import { NewDeckButton } from './_components/new-deck-button';
import { DeckListItem } from './_components/deck-list-item';

interface DeckSummary {
  id: string;
  name: string;
  leaderCardId: string | null;
  cards: Array<{ cardId: string; quantity: number }>;
  updatedAt: string;
}

export default function BuilderPage() {
  const { user, ready } = useUser();
  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch(apiUrl('/api/decks'), { headers: { 'x-user-id': user.id } })
      .then((r) => r.json())
      .then((data: DeckSummary[]) => setDecks(data))
      .catch((e: unknown) => setError((e as Error).message));
  }, [user]);

  if (!ready) return null;
  if (!user) return null;

  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your Decks</h1>
        <NewDeckButton
          onCreated={(deck) => {
            setDecks((prev) => (prev ? [deck, ...prev] : [deck]));
          }}
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {decks === null ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : decks.length === 0 ? (
        <p className="text-muted-foreground">No decks yet. Click &quot;New deck&quot; to start.</p>
      ) : (
        <ul className="space-y-2">
          {decks.map((d) => (
            <li key={d.id}>
              <DeckListItem
                deck={d}
                onDeleted={() => setDecks((prev) => prev?.filter((x) => x.id !== d.id) ?? null)}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
