import { z } from 'zod';
import type { CardDataService } from '../service';
import { rawToDomain } from '../helpers';
import { RawCardSchema, type DomainCard } from '../types';

const DEFAULT_BASE_URL = 'https://www.apitcg.com/api/one-piece';

const ResponseSchema = z.object({
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
    const url = `${this.baseUrl}/cards?code=${encodeURIComponent(setId)}`;
    const headers: Record<string, string> = { accept: 'application/json' };
    if (this.apiKey) headers['x-api-key'] = this.apiKey;

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
    const baseCards = parsed.data.filter((c) => !c.code || c.id === c.code);
    return baseCards.map(rawToDomain);
  }

  imageUrlFor(card: DomainCard): string {
    return card.sourceImageUrl;
  }
}
