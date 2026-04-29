'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/user-context';
import { apiUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface CreatedDeck {
  id: string;
  name: string;
  leaderCardId: string | null;
  cards: Array<{ cardId: string; quantity: number }>;
  updatedAt: string;
}

export function NewDeckButton({ onCreated }: { onCreated?: (deck: CreatedDeck) => void }) {
  const { user } = useUser();
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handle() {
    if (!user) return;
    setPending(true);
    const res = await fetch(apiUrl('/api/decks'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': user.id },
      body: JSON.stringify({ name: 'Untitled deck' }),
    });
    if (res.ok) {
      const deck = (await res.json()) as CreatedDeck;
      onCreated?.(deck);
      router.push(`/builder/${deck.id}`);
    } else {
      setPending(false);
    }
  }

  return (
    <Button onClick={handle} disabled={pending}>
      {pending ? 'Creating…' : 'New deck'}
    </Button>
  );
}
