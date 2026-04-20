import type { DomainCard, RawCard } from './types';

export function splitMultiValue(input: string | undefined): string[] {
  if (!input) return [];
  return input
    .split(/[/,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function normalizeCounter(input: number | string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isInteger(input) ? input : null;
  const trimmed = input.trim();
  if (trimmed === '' || trimmed === '-') return null;
  const n = Number(trimmed);
  return Number.isInteger(n) ? n : null;
}

export function rawToDomain(raw: RawCard): DomainCard {
  return {
    id: raw.id,
    setId: raw.set.id ?? (raw.code ?? raw.id).split('-')[0],
    setName: raw.set.name,
    name: raw.name,
    rarity: raw.rarity,
    type: raw.type,
    cost: raw.cost ?? null,
    power: raw.power ?? null,
    counter: normalizeCounter(raw.counter),
    life: raw.life ?? null,
    colors: splitMultiValue(raw.color),
    attributes: splitMultiValue(raw.family),
    effectText: raw.ability ?? '',
    triggerText: raw.trigger && raw.trigger.length > 0 ? raw.trigger : null,
    sourceImageUrl: raw.images.large,
  };
}
