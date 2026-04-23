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

type Mode = 'hotseat' | 'ai-easy' | 'ai-medium';

const MODE_LABELS: Record<Mode, string> = {
  hotseat: 'Hotseat',
  'ai-easy': 'vs AI Easy',
  'ai-medium': 'vs AI Medium',
};

const MODES: readonly Mode[] = ['hotseat', 'ai-easy', 'ai-medium'] as const;

export default function PlaySetupPage() {
  const { user, ready } = useUser();
  const router = useRouter();
  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  const [mode, setMode] = useState<Mode>('hotseat');
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

  const p0Label = mode === 'hotseat' ? 'Player 0 (first)' : 'Your deck (first)';
  const p1Label = mode === 'hotseat' ? 'Player 1' : 'AI deck';

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
      const aiOpponent: 'easy' | 'medium' | null =
        mode === 'ai-easy' ? 'easy' : mode === 'ai-medium' ? 'medium' : null;
      sessionStorage.setItem(`optcg.game.${gameId}`, JSON.stringify({ setup, aiOpponent }));
      router.push(`/play/${gameId}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New match</h1>
        <Button asChild variant="outline">
          <Link href="/play/online">Play online</Link>
        </Button>
      </div>

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
          <div className="space-y-2">
            <Label>Mode</Label>
            <div className="flex gap-3">
              {MODES.map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="mode"
                    value={m}
                    checked={mode === m}
                    onChange={() => setMode(m)}
                  />
                  {MODE_LABELS[m]}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <DeckSelector id="p0" label={p0Label} decks={legalDecks} value={p0} onChange={setP0} />
            <DeckSelector id="p1" label={p1Label} decks={legalDecks} value={p1} onChange={setP1} />
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
