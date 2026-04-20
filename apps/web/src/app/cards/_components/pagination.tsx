import Link from 'next/link';

interface Props {
  page: number;
  total: number;
  pageSize: number;
  searchParams: Record<string, string | string[] | undefined>;
}

function buildHref(base: Record<string, string | string[] | undefined>, page: number): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) {
    if (typeof v === 'string' && v.length > 0 && k !== 'page') params.set(k, v);
  }
  params.set('page', String(page));
  return `/cards?${params.toString()}`;
}

export function Pagination({ page, total, pageSize, searchParams }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);

  return (
    <nav className="mt-6 flex items-center justify-center gap-2 text-sm" aria-label="Pagination">
      <Link
        href={buildHref(searchParams, prev)}
        aria-disabled={page === 1}
        className={`rounded border px-3 py-1 ${page === 1 ? 'pointer-events-none opacity-50' : 'hover:bg-accent'}`}
      >
        ← Prev
      </Link>
      <span className="text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Link
        href={buildHref(searchParams, next)}
        aria-disabled={page === totalPages}
        className={`rounded border px-3 py-1 ${page === totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-accent'}`}
      >
        Next →
      </Link>
    </nav>
  );
}
