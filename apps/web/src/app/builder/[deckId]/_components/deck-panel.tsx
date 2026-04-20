'use client';

import Image from 'next/image';
import type { Card } from '@optcg/card-data';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { LeaderPicker } from './leader-picker';
import { validateDeck, type ValidationResult, type CardRow } from '@/lib/deck-validation';
import { ImportExport } from './import-export';

interface Props {
  name: string;
  leader: Card | null;
  catalog: Card[];
  cards: Array<{ cardId: string; quantity: number }>;
  onNameChange: (next: string) => void;
  onLeaderChange: (leader: Card) => void;
  onAdd: (cardId: string) => void;
  onRemove: (cardId: string) => void;
  onImport: (parsed: { cards: Array<{ cardId: string; quantity: number }> }) => void;
  onSave: () => void;
  saving: boolean;
}

export function DeckPanel({
  name,
  leader,
  catalog,
  cards,
  onNameChange,
  onLeaderChange,
  onAdd,
  onRemove,
  onImport,
  onSave,
  saving,
}: Props) {
  const cardIndex = new Map<string, CardRow>(
    catalog.map((c) => [
      c.id,
      { id: c.id, colors: c.colors.split(',').filter(Boolean), type: c.type },
    ]),
  );

  const validation = validateDeck({ leaderCardId: leader?.id ?? null, cards }, cardIndex);

  const rowsByCost = [...cards]
    .map((c) => {
      const card = catalog.find((x) => x.id === c.cardId);
      return { ...c, card };
    })
    .sort((a, b) => {
      const ca = a.card?.cost ?? 99;
      const cb = b.card?.cost ?? 99;
      if (ca !== cb) return ca - cb;
      return a.cardId.localeCompare(b.cardId);
    });

  return (
    <aside className="flex w-80 shrink-0 flex-col gap-3 rounded border p-4">
      <div className="flex items-center gap-2">
        <input
          className="flex-1 rounded border px-2 py-1 text-lg font-semibold"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          aria-label="Deck name"
        />
        <Button onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <LeaderPicker catalog={catalog} current={leader} onPick={onLeaderChange} />

      <Separator />

      <ValidationBadges validation={validation} />

      <Separator />

      <div className="flex items-center justify-between text-sm">
        <span>Main deck</span>
        <span className="text-muted-foreground">{validation.totalCards}/50</span>
      </div>

      <div className="max-h-[50vh] space-y-1 overflow-y-auto">
        {rowsByCost.map((row) => (
          <div key={row.cardId} className="flex items-center gap-2 text-xs">
            {row.card?.imagePath && (
              <div className="relative h-9 w-7 shrink-0 overflow-hidden rounded">
                <Image
                  src={row.card.imagePath}
                  alt={row.card.name}
                  fill
                  sizes="28px"
                  className="object-cover"
                />
              </div>
            )}
            <span className="flex-1 truncate">{row.card?.name ?? row.cardId}</span>
            <span className="w-10 text-right">
              {row.card?.cost !== null && row.card?.cost !== undefined ? `$${row.card.cost}` : ''}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded border px-1.5 text-xs disabled:opacity-30"
                onClick={() => onRemove(row.cardId)}
                disabled={row.quantity === 0}
              >
                −
              </button>
              <span className="w-4 text-center">{row.quantity}</span>
              <button
                type="button"
                className="rounded border px-1.5 text-xs disabled:opacity-30"
                onClick={() => onAdd(row.cardId)}
                disabled={row.quantity >= 4}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <Separator />

      <ImportExport name={name} leader={leader} cards={cards} onImport={onImport} />
    </aside>
  );
}

function ValidationBadges({ validation }: { validation: ValidationResult }) {
  const has = (kind: string) => validation.issues.some((i) => i.kind === kind);
  const rows: Array<{ label: string; ok: boolean }> = [
    { label: 'Leader set', ok: !has('missingLeader') },
    { label: '50 cards', ok: !has('wrongCount') },
    { label: 'Max 4 copies', ok: !has('overLimit') },
    { label: 'Colors match leader', ok: !has('colorMismatch') },
  ];
  return (
    <div className="space-y-1 text-xs">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${r.ok ? 'bg-green-500' : 'bg-red-500'}`}
            aria-hidden
          />
          <span>{r.label}</span>
        </div>
      ))}
    </div>
  );
}
