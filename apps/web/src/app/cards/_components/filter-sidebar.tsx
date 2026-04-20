'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CARD_TYPES } from '@optcg/card-data';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const COLORS = ['Red', 'Green', 'Blue', 'Purple', 'Black', 'Yellow'] as const;
const COSTS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;
const DEBOUNCE_MS = 250;

type CsvKey = 'color' | 'type' | 'cost';

export function FilterSidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(searchParams.get('q') ?? '');

  // Debounced q → URL
  useEffect(() => {
    const handle = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      if (q) next.set('q', q);
      else next.delete('q');
      next.delete('page');
      startTransition(() => {
        router.replace(`/cards?${next.toString()}`);
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function toggleCsv(key: CsvKey, value: string) {
    const current = new Set((searchParams.get(key) ?? '').split(',').filter(Boolean));
    if (current.has(value)) current.delete(value);
    else current.add(value);
    const next = new URLSearchParams(searchParams.toString());
    if (current.size === 0) next.delete(key);
    else next.set(key, [...current].join(','));
    next.delete('page');
    startTransition(() => {
      router.replace(`/cards?${next.toString()}`);
    });
  }

  function isChecked(key: CsvKey, value: string): boolean {
    return (searchParams.get(key) ?? '').split(',').includes(value);
  }

  return (
    <aside
      className={`w-56 shrink-0 space-y-6 ${isPending ? 'opacity-70' : ''}`}
      aria-busy={isPending}
    >
      <div>
        <Label htmlFor="q" className="text-xs font-semibold uppercase">
          Search
        </Label>
        <Input
          id="q"
          type="search"
          placeholder="Name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mt-2"
        />
      </div>
      <Separator />
      <FilterGroup title="Color">
        {COLORS.map((c) => (
          <FilterCheckbox
            key={c}
            id={`color-${c}`}
            label={c}
            checked={isChecked('color', c)}
            onChange={() => toggleCsv('color', c)}
          />
        ))}
      </FilterGroup>
      <Separator />
      <FilterGroup title="Type">
        {CARD_TYPES.map((t) => (
          <FilterCheckbox
            key={t}
            id={`type-${t}`}
            label={t}
            checked={isChecked('type', t)}
            onChange={() => toggleCsv('type', t)}
          />
        ))}
      </FilterGroup>
      <Separator />
      <FilterGroup title="Cost">
        {COSTS.map((c) => (
          <FilterCheckbox
            key={c}
            id={`cost-${c}`}
            label={c}
            checked={isChecked('cost', c)}
            onChange={() => toggleCsv('cost', c)}
          />
        ))}
      </FilterGroup>
    </aside>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function FilterCheckbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
        {label}
      </Label>
    </div>
  );
}
