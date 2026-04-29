import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from '../src/prisma';
import type { CardStatic, CardType } from '@optcg/engine';
import { getEffectsForCard } from '@optcg/engine';

interface Row {
  id: string;
  type: string;
  colors: string;
  cost: number | null;
  power: number | null;
  counter: number | null;
  effectText: string | null;
}

function normalizeType(t: string): CardType {
  if (t === 'LEADER' || t === 'CHARACTER' || t === 'EVENT' || t === 'STAGE') return t;
  return 'CHARACTER';
}

function parseKeywords(effectText: string | null | undefined): CardStatic['keywords'] {
  if (!effectText) return [];
  const text = effectText.toLowerCase();
  const keywords: CardStatic['keywords'] = [];
  if (text.includes('[rush]')) keywords.push('Rush');
  if (text.includes('[blocker]')) keywords.push('Blocker');
  if (text.includes('[double attack]') || text.includes('[doubleattack]')) {
    keywords.push('DoubleAttack');
  }
  if (text.includes('[banish]')) keywords.push('Banish');
  return keywords;
}

function cardToStatic(c: Row): CardStatic {
  const type = normalizeType(c.type);
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

export function buildCatalogFromRows(rows: Row[]): Record<string, CardStatic> {
  const out: Record<string, CardStatic> = {};
  for (const r of rows) out[r.id] = cardToStatic(r);
  return out;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const outputPath = args[0];
  if (!outputPath) {
    console.error('Usage: export-catalog <output-path>');
    process.exit(1);
  }
  const cards = await prisma.card.findMany();
  const catalog = buildCatalogFromRows(cards as Row[]);
  const absolute = resolve(process.cwd(), outputPath);
  writeFileSync(absolute, JSON.stringify(catalog, null, 2));
  console.log(`Wrote ${Object.keys(catalog).length} cards to ${absolute}`);
  await prisma.$disconnect();
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('export-catalog.ts')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
