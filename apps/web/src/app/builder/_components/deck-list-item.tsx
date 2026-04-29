'use client';

import Link from 'next/link';
import { useUser } from '@/lib/user-context';
import { apiUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface DeckSummary {
  id: string;
  name: string;
  leaderCardId: string | null;
  cards: Array<{ cardId: string; quantity: number }>;
}

export function DeckListItem({ deck, onDeleted }: { deck: DeckSummary; onDeleted?: () => void }) {
  const { user } = useUser();
  const totalCards = deck.cards.reduce((s, c) => s + c.quantity, 0);

  async function handleDelete() {
    if (!user) return;
    if (!confirm(`Delete "${deck.name}"?`)) return;
    const res = await fetch(apiUrl(`/api/decks/${deck.id}`), {
      method: 'DELETE',
      headers: { 'x-user-id': user.id },
    });
    if (res.ok) onDeleted?.();
  }

  return (
    <div className="flex items-center justify-between rounded border p-3">
      <div>
        <div className="font-medium">{deck.name}</div>
        <div className="text-xs text-muted-foreground">
          {deck.leaderCardId ? `Leader: ${deck.leaderCardId}` : 'No leader'} · {totalCards}/50 cards
        </div>
      </div>
      <div className="flex gap-2">
        <Link href={`/builder/${deck.id}`}>
          <Button variant="secondary">Open</Button>
        </Link>
        <Button variant="destructive" onClick={handleDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}
