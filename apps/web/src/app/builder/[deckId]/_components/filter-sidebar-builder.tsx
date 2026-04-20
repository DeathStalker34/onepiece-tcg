'use client';

import { CARD_TYPES } from '@optcg/card-data';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const COLORS = ['Red', 'Green', 'Blue', 'Purple', 'Black', 'Yellow'] as const;
const COSTS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;

export interface BuilderFilters {
  q: string;
  colors: string[];
  types: string[];
  costs: number[];
}

export const INITIAL_FILTERS: BuilderFilters = { q: '', colors: [], types: [], costs: [] };

export function FilterSidebarBuilder({
  filters,
  onChange,
}: {
  filters: BuilderFilters;
  onChange: (next: BuilderFilters) => void;
}) {
  function toggleColor(c: string) {
    onChange({
      ...filters,
      colors: filters.colors.includes(c)
        ? filters.colors.filter((x) => x !== c)
        : [...filters.colors, c],
    });
  }
  function toggleType(t: string) {
    onChange({
      ...filters,
      types: filters.types.includes(t)
        ? filters.types.filter((x) => x !== t)
        : [...filters.types, t],
    });
  }
  function toggleCost(c: string) {
    const n = Number(c);
    onChange({
      ...filters,
      costs: filters.costs.includes(n)
        ? filters.costs.filter((x) => x !== n)
        : [...filters.costs, n],
    });
  }

  return (
    <aside className="w-56 shrink-0 space-y-4">
      <div>
        <Label htmlFor="q">Search</Label>
        <Input
          id="q"
          value={filters.q}
          onChange={(e) => onChange({ ...filters, q: e.target.value })}
          placeholder="Name…"
          className="mt-2"
        />
      </div>
      <Separator />
      <div>
        <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Color</div>
        {COLORS.map((c) => (
          <div key={c} className="flex items-center gap-2">
            <Checkbox
              id={`color-${c}`}
              checked={filters.colors.includes(c)}
              onCheckedChange={() => toggleColor(c)}
            />
            <Label htmlFor={`color-${c}`}>{c}</Label>
          </div>
        ))}
      </div>
      <Separator />
      <div>
        <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Type</div>
        {CARD_TYPES.filter((t) => t !== 'DON').map((t) => (
          <div key={t} className="flex items-center gap-2">
            <Checkbox
              id={`type-${t}`}
              checked={filters.types.includes(t)}
              onCheckedChange={() => toggleType(t)}
            />
            <Label htmlFor={`type-${t}`}>{t}</Label>
          </div>
        ))}
      </div>
      <Separator />
      <div>
        <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Cost</div>
        {COSTS.map((c) => (
          <div key={c} className="flex items-center gap-2">
            <Checkbox
              id={`cost-${c}`}
              checked={filters.costs.includes(Number(c))}
              onCheckedChange={() => toggleCost(c)}
            />
            <Label htmlFor={`cost-${c}`}>{c}</Label>
          </div>
        ))}
      </div>
    </aside>
  );
}
