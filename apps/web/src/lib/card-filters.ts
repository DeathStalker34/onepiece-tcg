import type { Card } from '@optcg/card-data';

export const PAGE_SIZE = 48;

export interface SearchParams {
  q?: string | string[];
  color?: string | string[];
  type?: string | string[];
  cost?: string | string[];
  page?: string | string[];
  [key: string]: string | string[] | undefined;
}

export interface Where {
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

/**
 * In-memory equivalent of running the Prisma `where` against a card list.
 * Used by the gallery page now that Card data lives in cards.json (no DB).
 */
export function applyFilters(cards: Card[], where: Where): Card[] {
  return cards.filter((card) => {
    if (where.name && !card.name.toLowerCase().includes(where.name.contains.toLowerCase())) {
      return false;
    }
    if (where.colors && !card.colors.includes(where.colors.contains)) {
      return false;
    }
    if (where.AND && where.AND.length > 0) {
      for (const clause of where.AND) {
        if (!card.colors.includes(clause.colors.contains)) return false;
      }
    }
    if (where.type && card.type !== where.type) {
      return false;
    }
    if (where.cost !== undefined) {
      if (typeof where.cost === 'number') {
        if (card.cost !== where.cost) return false;
      } else {
        if (card.cost === null || !where.cost.in.includes(card.cost)) return false;
      }
    }
    return true;
  });
}
