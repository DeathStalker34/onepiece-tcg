import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ApitcgAdapter } from '../src/adapters/apitcg';

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, 'fixtures/apitcg-op01-sample.json'), 'utf8'),
);

describe('ApitcgAdapter.listCardsInSet', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('OP01')) {
          return new Response(JSON.stringify(fixture), { status: 200 });
        }
        return new Response('not found', { status: 404 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns 5 DomainCards for OP01', async () => {
    const adapter = new ApitcgAdapter();
    const cards = await adapter.listCardsInSet('OP01');
    expect(cards).toHaveLength(5);
  });

  it('maps a LEADER correctly', async () => {
    const adapter = new ApitcgAdapter();
    const cards = await adapter.listCardsInSet('OP01');
    const zoro = cards.find((c) => c.id === 'OP01-001');
    expect(zoro).toBeDefined();
    expect(zoro!.type).toBe('LEADER');
    expect(zoro!.life).toBe(4);
    expect(zoro!.cost).toBeNull();
    expect(zoro!.colors).toEqual(['Green']);
    expect(zoro!.attributes).toEqual(['Supernovas', 'Straw Hat Crew']);
  });

  it('maps a multi-color STAGE correctly', async () => {
    const adapter = new ApitcgAdapter();
    const cards = await adapter.listCardsInSet('OP01');
    const sunny = cards.find((c) => c.id === 'OP01-089');
    expect(sunny!.colors).toEqual(['Red', 'Green']);
  });

  it('maps a CHARACTER with trigger', async () => {
    const adapter = new ApitcgAdapter();
    const cards = await adapter.listCardsInSet('OP01');
    const usopp = cards.find((c) => c.id === 'OP01-013');
    expect(usopp!.type).toBe('CHARACTER');
    expect(usopp!.counter).toBe(1000);
    expect(usopp!.triggerText).toContain('Draw 1 card');
  });

  it('throws when the upstream response is malformed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"data":[{"broken":true}]}', { status: 200 })),
    );
    const adapter = new ApitcgAdapter();
    await expect(adapter.listCardsInSet('OP01')).rejects.toThrow();
  });

  it('throws with the apitcg error message when the upstream returns an error envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: 'API key is required, register into: https://apitcg.com/platform',
            }),
            { status: 200 },
          ),
      ),
    );
    const adapter = new ApitcgAdapter();
    await expect(adapter.listCardsInSet('OP01')).rejects.toThrow(/API key is required/);
  });

  it('imageUrlFor returns the DomainCard.sourceImageUrl', async () => {
    const adapter = new ApitcgAdapter();
    const cards = await adapter.listCardsInSet('OP01');
    expect(adapter.imageUrlFor(cards[0])).toBe(cards[0].sourceImageUrl);
  });

  it('queries apitcg with ?code=<setId>, not ?set=', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url);
        return new Response(JSON.stringify(fixture), { status: 200 });
      }),
    );
    const adapter = new ApitcgAdapter();
    await adapter.listCardsInSet('OP01');
    expect(calls[0]).toContain('code=OP01');
    expect(calls[0]).not.toContain('set=OP01');
  });

  it('filters out alt-art variants where id !== code', async () => {
    const payload = {
      data: [
        {
          id: 'OP01-060',
          code: 'OP01-060',
          name: 'Red-Haired Shanks',
          rarity: 'SR',
          type: 'CHARACTER',
          cost: 5,
          power: 6000,
          color: 'Red',
          ability: 'Rush.',
          set: { id: 'OP01', name: 'Romance Dawn' },
          images: { large: 'https://example.com/OP01-060.png' },
        },
        {
          id: 'OP01-060_p2',
          code: 'OP01-060',
          name: 'Red-Haired Shanks',
          rarity: 'SR',
          type: 'CHARACTER',
          cost: 5,
          power: 6000,
          color: 'Red',
          ability: 'Rush.',
          set: { id: 'OP01', name: 'Romance Dawn' },
          images: { large: 'https://example.com/OP01-060_p2.png' },
        },
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })),
    );
    const adapter = new ApitcgAdapter();
    const cards = await adapter.listCardsInSet('OP01');
    expect(cards).toHaveLength(1);
    expect(cards[0].id).toBe('OP01-060');
  });
});
