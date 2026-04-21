import type { Card } from '@optcg/card-data';
import type { CardStatic, CardType, Keyword } from '@optcg/engine';
import { getEffectsForCard } from '@optcg/engine';

export function buildCatalog(cards: Card[]): Record<string, CardStatic> {
  const map: Record<string, CardStatic> = {};
  for (const c of cards) {
    map[c.id] = cardToStatic(c);
  }
  return map;
}

export function cardToStatic(c: Card): CardStatic {
  const type = normalizeType(c.type);
  // apitcg stores LEADER life in the cost field (Fase 1 concern).
  const life = type === 'LEADER' ? c.cost : null;
  const cost = type === 'LEADER' ? null : c.cost;
  return {
    id: c.id,
    type,
    colors: c.colors
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    cost,
    power: c.power,
    life,
    counter: c.counter,
    keywords: parseKeywords(c.effectText),
    effects: getEffectsForCard(c.id),
    manualText: c.effectText && c.effectText.length > 0 ? c.effectText : null,
  };
}

function normalizeType(t: string): CardType {
  if (t === 'LEADER' || t === 'CHARACTER' || t === 'EVENT' || t === 'STAGE') return t;
  // DON is filtered at deck-build level; any unknown type defaults to CHARACTER.
  return 'CHARACTER';
}

export function parseKeywords(effectText: string | null | undefined): Keyword[] {
  if (!effectText) return [];
  const text = effectText.toLowerCase();
  const keywords: Keyword[] = [];
  if (text.includes('[rush]')) keywords.push('Rush');
  if (text.includes('[blocker]')) keywords.push('Blocker');
  if (text.includes('[double attack]') || text.includes('[doubleattack]')) {
    keywords.push('DoubleAttack');
  }
  if (text.includes('[banish]')) keywords.push('Banish');
  return keywords;
}
