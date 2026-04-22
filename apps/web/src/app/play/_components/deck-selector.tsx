'use client';

import { Label } from '@/components/ui/label';

interface DeckSummary {
  id: string;
  name: string;
  leaderCardId: string | null;
  cards: Array<{ cardId: string; quantity: number }>;
}

export function DeckSelector({
  id,
  label,
  decks,
  value,
  onChange,
}: {
  id: string;
  label: string;
  decks: DeckSummary[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
      >
        <option value="" disabled>
          Pick a deck
        </option>
        {decks.map((d) => {
          const total = d.cards.reduce((s, c) => s + c.quantity, 0);
          const isLegal = d.leaderCardId && total === 50;
          return (
            <option key={d.id} value={d.id} disabled={!isLegal}>
              {d.name} — {total}/50 {d.leaderCardId ? '' : '(no leader)'}
              {!isLegal ? ' (not legal)' : ''}
            </option>
          );
        })}
      </select>
    </div>
  );
}
