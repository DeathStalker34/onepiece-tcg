'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/lib/user-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DeckSelector } from './_components/deck-selector';

interface DeckSummary {
  id: string;
  name: string;
  leaderCardId: string | null;
  cards: Array<{ cardId: string; quantity: number }>;
}

export default function PlaySetupPage() {
  const { user, ready } = useUser();
  const router = useRouter();
  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  const [p0, setP0] = useState<string | null>(null);
  const [p1, setP1] = useState<string | null>(null);
  const [seed, setSeed] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch('/api/decks', { headers: { 'x-user-id': user.id } })
      .then((r) => r.json() as Promise<DeckSummary[]>)
      .then(setDecks)
      .catch((e: unknown) => setError((e as Error).message));
  }, [user]);

  if (!ready) return null;
  if (!user) return null; // UserGate handles

  const legalDecks = decks?.filter(
    (d) => d.leaderCardId && d.cards.reduce((s, c) => s + c.quantity, 0) === 50,
  );

  async function handleStart(e: FormEvent) {
    e.preventDefault();
    if (!p0 || !p1 || !user) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: { p0DeckId: string; p1DeckId: string; seed?: number } = {
        p0DeckId: p0,
        p1DeckId: p1,
      };
      const trimmed = seed.trim();
      if (trimmed.length > 0) {
        const s = Number(trimmed);
        if (!Number.isInteger(s)) throw new Error('Seed must be an integer');
        body.seed = s;
      }
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-user-id': user.id },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }
      const { gameId, setup } = (await res.json()) as { gameId: string; setup: unknown };
      // Store setup in sessionStorage for the game page to pick up
      sessionStorage.setItem(`optcg.game.${gameId}`, JSON.stringify(setup));
      router.push(`/play/${gameId}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">New match</h1>

      {decks === null && <p className="text-muted-foreground">Loading decks…</p>}

      {decks && legalDecks && legalDecks.length === 0 && (
        <p className="text-muted-foreground">
          No legal decks yet.{' '}
          <Link href="/builder" className="underline">
            Create one in the builder
          </Link>
          .
        </p>
      )}

      {legalDecks && legalDecks.length > 0 && (
        <form onSubmit={handleStart} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <DeckSelector
              id="p0"
              label="Player 0 (first)"
              decks={legalDecks}
              value={p0}
              onChange={setP0}
            />
            <DeckSelector id="p1" label="Player 1" decks={legalDecks} value={p1} onChange={setP1} />
          </div>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="seed">Seed (optional)</Label>
            <Input
              id="seed"
              placeholder="Random"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" disabled={!p0 || !p1 || submitting}>
              {submitting ? 'Starting…' : 'Start game'}
            </Button>
            <Button asChild variant="secondary">
              <Link href="/">Cancel</Link>
            </Button>
          </div>
        </form>
      )}
    </main>
  );
}
