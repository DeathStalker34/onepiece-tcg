import type { DomainCard, RawCard } from './types';

export function splitMultiValue(input: string | undefined): string[] {
  if (!input) return [];
  return input
    .split(/[/,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function rawToDomain(raw: RawCard): DomainCard {
  return {
    id: raw.id,
    setId: raw.set.id,
    setName: raw.set.name,
    name: raw.name,
    rarity: raw.rarity,
    type: raw.type,
    cost: raw.cost ?? null,
    power: raw.power ?? null,
    counter: raw.counter ?? null,
    life: raw.life ?? null,
    colors: splitMultiValue(raw.color),
    attributes: splitMultiValue(raw.family),
    effectText: raw.ability ?? '',
    triggerText: raw.trigger ?? null,
    sourceImageUrl: raw.images.large,
  };
}
