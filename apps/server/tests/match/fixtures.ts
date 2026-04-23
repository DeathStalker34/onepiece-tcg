import type { CardStatic } from '@optcg/engine';

export const CATALOG: Record<string, CardStatic> = {
  'OP01-001': {
    id: 'OP01-001',
    type: 'LEADER',
    colors: ['Red'],
    cost: null,
    power: 5000,
    life: 5,
    counter: null,
    keywords: [],
    effects: [],
    manualText: null,
  },
  'OP01-006': {
    id: 'OP01-006',
    type: 'CHARACTER',
    colors: ['Red'],
    cost: 3,
    power: 4000,
    life: null,
    counter: 1000,
    keywords: [],
    effects: [],
    manualText: null,
  },
};

export function validDeck(): string[] {
  return Array(50).fill('OP01-006');
}
