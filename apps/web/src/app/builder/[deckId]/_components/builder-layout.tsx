'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Card } from '@optcg/card-data';
import { useUser } from '@/lib/user-context';
import { apiUrl } from '@/lib/api';
import { CardDetailDialog } from '@/app/cards/_components/card-detail-dialog';
import {
  FilterSidebarBuilder,
  INITIAL_FILTERS,
  type BuilderFilters,
} from './filter-sidebar-builder';
import { CardGridBuilder } from './card-grid-builder';
import { DeckPanel } from './deck-panel';

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
  const router = useRouter();
  const { user, ready } = useUser();
  const [deck, setDeck] = useState<DeckDraftState | null>(null);
  const [catalog, setCatalog] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [filters, setFilters] = useState<BuilderFilters>(INITIAL_FILTERS);
  const [inspecting, setInspecting] = useState<Card | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch(apiUrl(`/api/decks/${deckId}`), { headers: { 'x-user-id': user.id } }).then(
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
    setSaveStatus('idle');
    setSaveError(null);
    try {
      const res = await fetch(apiUrl(`/api/decks/${deckId}`), {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-user-id': user.id },
        body: JSON.stringify({
          name: deck.name,
          leaderCardId: deck.leaderCardId,
          cards: deck.cards,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setSaveStatus('error');
        setSaveError(body.error ?? `HTTP ${res.status}`);
      } else {
        setSaveStatus('saved');
        router.push('/builder');
      }
    } catch (err) {
      setSaveStatus('error');
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function addCard(cardId: string) {
    setDeck((d) => {
      if (!d) return d;
      const existing = d.cards.find((c) => c.cardId === cardId);
      if (existing) {
        if (existing.quantity >= 4) return d;
        return {
          ...d,
          cards: d.cards.map((c) => (c.cardId === cardId ? { ...c, quantity: c.quantity + 1 } : c)),
        };
      }
      return { ...d, cards: [...d.cards, { cardId, quantity: 1 }] };
    });
  }

  function removeCard(cardId: string) {
    setDeck((d) => {
      if (!d) return d;
      const existing = d.cards.find((c) => c.cardId === cardId);
      if (!existing) return d;
      if (existing.quantity <= 1) {
        return { ...d, cards: d.cards.filter((c) => c.cardId !== cardId) };
      }
      return {
        ...d,
        cards: d.cards.map((c) => (c.cardId === cardId ? { ...c, quantity: c.quantity - 1 } : c)),
      };
    });
  }

  if (!ready) return null;
  if (!user) return null;
  if (loading) return <p className="p-6">Loading…</p>;
  if (!deck) return <p className="p-6 text-red-500">Deck not found</p>;

  const leader = deck.leaderCardId ? catalog.find((c) => c.id === deck.leaderCardId) : null;
  const leaderColors = leader ? leader.colors.split(',').filter(Boolean) : [];

  const filteredCards = catalog.filter((c) => {
    if (c.type === 'DON' || c.type === 'LEADER') return false;
    if (filters.q && !c.name.toLowerCase().includes(filters.q.toLowerCase())) return false;
    if (filters.types.length > 0 && !filters.types.includes(c.type)) return false;
    if (filters.costs.length > 0 && (c.cost === null || !filters.costs.includes(c.cost)))
      return false;
    if (filters.colors.length > 0) {
      const cs = c.colors.split(',').filter(Boolean);
      if (!filters.colors.some((col) => cs.includes(col))) return false;
    }
    return true;
  });

  return (
    <div className="flex gap-6 p-6">
      <FilterSidebarBuilder filters={filters} onChange={setFilters} />
      <main className="flex-1">
        <CardGridBuilder
          cards={filteredCards}
          deckCards={deck.cards}
          leaderColors={leaderColors}
          onAdd={addCard}
          onRemove={removeCard}
          onInspect={setInspecting}
        />
      </main>
      <DeckPanel
        name={deck.name}
        leader={leader ?? null}
        catalog={catalog}
        cards={deck.cards}
        onNameChange={(n) => setDeck((d) => (d ? { ...d, name: n } : d))}
        onLeaderChange={(l) => setDeck((d) => (d ? { ...d, leaderCardId: l.id } : d))}
        onAdd={addCard}
        onRemove={removeCard}
        onImport={(parsed) => setDeck((d) => (d ? { ...d, cards: parsed.cards } : d))}
        onSave={handleSave}
        saveStatus={saveStatus}
        saveError={saveError}
        saving={saving}
      />
      <CardDetailDialog
        card={inspecting}
        open={!!inspecting}
        onOpenChange={(o) => {
          if (!o) setInspecting(null);
        }}
      />
    </div>
  );
}
