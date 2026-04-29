import type { Card } from '@optcg/card-data';
import cardsData from '@/data/cards.json';
import { PAGE_SIZE, parseFilters, applyFilters, type SearchParams } from '@/lib/card-filters';
import { CardGrid } from './_components/card-grid';
import { FilterSidebar } from './_components/filter-sidebar';
import { Pagination } from './_components/pagination';

const ALL_CARDS = (cardsData as unknown as Card[]).slice().sort((a, b) => a.id.localeCompare(b.id));

export default function CardsPage({ searchParams }: { searchParams: SearchParams }) {
  const { where, page, skip } = parseFilters(searchParams);
  const filtered = applyFilters(ALL_CARDS, where);
  const total = filtered.length;
  const cards = filtered.slice(skip, skip + PAGE_SIZE);

  return (
    <div className="flex gap-6 p-6">
      <FilterSidebar />
      <main className="flex-1">
        <div className="mb-4 text-sm text-muted-foreground">
          {total} cards · page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
        </div>
        <CardGrid cards={cards} />
        <Pagination page={page} total={total} pageSize={PAGE_SIZE} searchParams={searchParams} />
      </main>
    </div>
  );
}
