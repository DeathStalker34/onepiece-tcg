export const PAGE_SIZE = 48;

export interface SearchParams {
  q?: string | string[];
  color?: string | string[];
  type?: string | string[];
  cost?: string | string[];
  page?: string | string[];
  [key: string]: string | string[] | undefined;
}

interface Where {
  name?: { contains: string };
  colors?: { contains: string };
  type?: string;
  cost?: number | { in: number[] };
  AND?: Array<{ colors: { contains: string } }>;
}

export interface ParsedFilters {
  where: Where;
  page: number;
  skip: number;
}

function splitCsv(input: string): string[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function parseFilters(params: SearchParams): ParsedFilters {
  const where: Where = {};

  const q = first(params.q);
  const color = first(params.color);
  const type = first(params.type);
  const cost = first(params.cost);
  const pageRaw = first(params.page);

  if (q && q.length > 0) {
    where.name = { contains: q };
  }

  if (color) {
    const colors = splitCsv(color);
    if (colors.length === 1) {
      where.colors = { contains: colors[0] };
    } else if (colors.length > 1) {
      where.AND = colors.map((c) => ({ colors: { contains: c } }));
    }
  }

  if (type) {
    where.type = type;
  }

  if (cost) {
    const costs = splitCsv(cost)
      .map((s) => Number(s))
      .filter((n) => Number.isInteger(n));
    if (costs.length === 1) {
      where.cost = costs[0];
    } else if (costs.length > 1) {
      where.cost = { in: costs };
    }
  }

  const parsedPage = Number(pageRaw);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const skip = (page - 1) * PAGE_SIZE;

  return { where, page, skip };
}
