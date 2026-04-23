import { readFileSync, existsSync } from 'node:fs';
import type { CardStatic } from '@optcg/engine';

export function loadCatalog(path: string): Record<string, CardStatic> {
  if (!existsSync(path)) {
    throw new Error(`catalog.json not found at ${path}`);
  }
  const raw = readFileSync(path, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid catalog JSON: ${(err as Error).message}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('catalog JSON must be an object keyed by card id');
  }
  return parsed as Record<string, CardStatic>;
}
