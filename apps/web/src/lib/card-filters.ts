export const PAGE_SIZE = 48;

export interface SearchParams {
  q?: string;
  color?: string;
  type?: string;
  cost?: string;
  page?: string;
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

export function parseFilters(params: SearchParams): ParsedFilters {
  const where: Where = {};

  if (params.q && params.q.length > 0) {
    where.name = { contains: params.q };
  }

  if (params.color) {
    const colors = splitCsv(params.color);
    if (colors.length === 1) {
      where.colors = { contains: colors[0] };
    } else if (colors.length > 1) {
      where.AND = colors.map((c) => ({ colors: { contains: c } }));
    }
  }

  if (params.type) {
    where.type = params.type;
  }

  if (params.cost) {
    const costs = splitCsv(params.cost)
      .map((s) => Number(s))
      .filter((n) => Number.isInteger(n));
    if (costs.length === 1) {
      where.cost = costs[0];
    } else if (costs.length > 1) {
      where.cost = { in: costs };
    }
  }

  const parsedPage = Number(params.page);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const skip = (page - 1) * PAGE_SIZE;

  return { where, page, skip };
}
