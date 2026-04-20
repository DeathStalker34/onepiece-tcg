import { prisma } from '@optcg/card-data';
import { PAGE_SIZE, parseFilters, type SearchParams } from '@/lib/card-filters';
import { CardGrid } from './_components/card-grid';
import { FilterSidebar } from './_components/filter-sidebar';
import { Pagination } from './_components/pagination';

export const dynamic = 'force-dynamic';

export default async function CardsPage({ searchParams }: { searchParams: SearchParams }) {
  const { where, page, skip } = parseFilters(searchParams);

  const [cards, total] = await Promise.all([
    prisma.card.findMany({
      where,
      skip,
      take: PAGE_SIZE,
      orderBy: { id: 'asc' },
    }),
    prisma.card.count({ where }),
  ]);

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
