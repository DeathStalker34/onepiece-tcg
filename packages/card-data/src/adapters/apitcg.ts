import { z } from 'zod';
import type { CardDataService } from '../service';
import { rawToDomain } from '../helpers';
import { RawCardSchema, type DomainCard } from '../types';

const DEFAULT_BASE_URL = 'https://www.apitcg.com/api/one-piece';
const PAGE_LIMIT = 100;

const ResponseSchema = z.object({
  page: z.number().int().optional(),
  limit: z.number().int().optional(),
  total: z.number().int().optional(),
  totalPages: z.number().int().optional(),
  data: z.array(RawCardSchema),
});

export interface ApitcgAdapterOptions {
  baseUrl?: string;
  apiKey?: string;
}

export class ApitcgAdapter implements CardDataService {
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(opts: ApitcgAdapterOptions = {}) {
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
    this.apiKey = opts.apiKey;
  }

  async listCardsInSet(setId: string): Promise<DomainCard[]> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (this.apiKey) headers['x-api-key'] = this.apiKey;

    const allRaw: z.infer<typeof RawCardSchema>[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const url = `${this.baseUrl}/cards?code=${encodeURIComponent(setId)}&limit=${PAGE_LIMIT}&page=${page}`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new Error(`apitcg returned ${res.status} for set ${setId}`);
      }

      const json = (await res.json()) as unknown;
      if (typeof json === 'object' && json !== null && 'error' in json) {
        const message = String((json as { error: unknown }).error);
        throw new Error(`apitcg error: ${message}`);
      }
      const parsed = ResponseSchema.parse(json);
      allRaw.push(...parsed.data);
      totalPages = parsed.totalPages ?? 1;
      page += 1;
    } while (page <= totalPages);

    const baseCards = allRaw.filter((c) => !c.code || c.id === c.code);
    return baseCards.map(rawToDomain);
  }

  imageUrlFor(card: DomainCard): string {
    return card.sourceImageUrl;
  }
}
