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
    expect(zoro!.setId).toBe('OP01');
    expect(zoro!.colors).toEqual(['Red']);
    expect(zoro!.attributes).toEqual(['Supernovas', 'Straw Hat Crew']);
    // real apitcg omits `life` for LEADERs — domain should be null
    expect(zoro!.life).toBeNull();
    // counter "-" sentinel normalized to null
    expect(zoro!.counter).toBeNull();
  });

  it('maps a multi-color LEADER correctly', async () => {
    const adapter = new ApitcgAdapter();
    const cards = await adapter.listCardsInSet('OP01');
    const law = cards.find((c) => c.id === 'OP01-002');
    expect(law!.colors).toEqual(['Red', 'Green']);
  });

  it('maps an EVENT with null power', async () => {
    const adapter = new ApitcgAdapter();
    const cards = await adapter.listCardsInSet('OP01');
    const event = cards.find((c) => c.id === 'OP01-026');
    expect(event!.type).toBe('EVENT');
    expect(event!.power).toBeNull();
    expect(event!.counter).toBeNull();
  });

  it('maps a CHARACTER with non-empty trigger', async () => {
    const adapter = new ApitcgAdapter();
    const cards = await adapter.listCardsInSet('OP01');
    const kawamatsu = cards.find((c) => c.id === 'OP01-037');
    expect(kawamatsu!.type).toBe('CHARACTER');
    expect(kawamatsu!.triggerText).toContain('Play this card');
    expect(kawamatsu!.counter).toBe(1000);
  });

  it('maps a CHARACTER with numeric counter', async () => {
    const adapter = new ApitcgAdapter();
    const cards = await adapter.listCardsInSet('OP01');
    const usopp = cards.find((c) => c.id === 'OP01-004');
    expect(usopp!.type).toBe('CHARACTER');
    expect(usopp!.counter).toBe(2000);
    // empty-string trigger should map to null
    expect(usopp!.triggerText).toBeNull();
  });

  it('derives setId from code when set.id is missing (real apitcg shape)', async () => {
    const adapter = new ApitcgAdapter();
    const cards = await adapter.listCardsInSet('OP01');
    cards.forEach((c) => expect(c.setId).toBe('OP01'));
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
