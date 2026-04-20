import type { CardStatic } from '../../src/types/card';

/**
 * Synthetic test catalog. All IDs use the `TEST-*` prefix so they never collide
 * with real apitcg.com card IDs. Red is the sole color to keep fixtures simple
 * and to ensure every card is legal against any test leader.
 */
export const TEST_CATALOG: Record<string, CardStatic> = {
  'TEST-LEADER-01': {
    id: 'TEST-LEADER-01',
    type: 'LEADER',
    colors: ['Red'],
    cost: null,
    power: 5000,
    life: 4,
    counter: null,
    keywords: [],
    effects: [
      {
        trigger: 'Activate:Main',
        cost: { rest: 'self' },
        effect: {
          kind: 'power',
          target: { kind: 'self' },
          delta: 1000,
          duration: 'thisTurn',
        },
      },
    ],
    manualText: null,
  },

  'TEST-LEADER-02': {
    id: 'TEST-LEADER-02',
    type: 'LEADER',
    colors: ['Red'],
    cost: null,
    power: 5000,
    life: 4,
    counter: null,
    keywords: [],
    effects: [],
    manualText: null,
  },

  'TEST-CHAR-BASIC-01': {
    id: 'TEST-CHAR-BASIC-01',
    type: 'CHARACTER',
    colors: ['Red'],
    cost: 1,
    power: 2000,
    life: null,
    counter: 1000,
    keywords: [],
    effects: [],
    manualText: null,
  },

  'TEST-CHAR-BASIC-02': {
    id: 'TEST-CHAR-BASIC-02',
    type: 'CHARACTER',
    colors: ['Red'],
    cost: 2,
    power: 3000,
    life: null,
    counter: 1000,
    keywords: [],
    effects: [],
    manualText: null,
  },

  'TEST-CHAR-RUSH': {
    id: 'TEST-CHAR-RUSH',
    type: 'CHARACTER',
    colors: ['Red'],
    cost: 4,
    power: 5000,
    life: null,
    counter: 1000,
    keywords: ['Rush'],
    effects: [],
    manualText: null,
  },

  'TEST-CHAR-BLOCKER': {
    id: 'TEST-CHAR-BLOCKER',
    type: 'CHARACTER',
    colors: ['Red'],
    cost: 3,
    power: 4000,
    life: null,
    counter: 1000,
    keywords: ['Blocker'],
    effects: [],
    manualText: null,
  },

  'TEST-CHAR-COUNTER': {
    id: 'TEST-CHAR-COUNTER',
    type: 'CHARACTER',
    colors: ['Red'],
    cost: 2,
    power: 2000,
    life: null,
    counter: 2000,
    keywords: [],
    effects: [],
    manualText: null,
  },

  'TEST-CHAR-DOUBLEATTACK': {
    id: 'TEST-CHAR-DOUBLEATTACK',
    type: 'CHARACTER',
    colors: ['Red'],
    cost: 5,
    power: 6000,
    life: null,
    counter: 1000,
    keywords: ['DoubleAttack'],
    effects: [],
    manualText: null,
  },

  'TEST-CHAR-BANISH': {
    id: 'TEST-CHAR-BANISH',
    type: 'CHARACTER',
    colors: ['Red'],
    cost: 3,
    power: 4000,
    life: null,
    counter: 1000,
    keywords: ['Banish'],
    effects: [],
    manualText: null,
  },

  'TEST-CHAR-ONPLAY-DRAW': {
    id: 'TEST-CHAR-ONPLAY-DRAW',
    type: 'CHARACTER',
    colors: ['Red'],
    cost: 2,
    power: 3000,
    life: null,
    counter: 1000,
    keywords: [],
    effects: [
      {
        trigger: 'OnPlay',
        effect: { kind: 'draw', amount: 1 },
      },
    ],
    manualText: null,
  },

  'TEST-CHAR-ONKO-BANISH': {
    id: 'TEST-CHAR-ONKO-BANISH',
    type: 'CHARACTER',
    colors: ['Red'],
    cost: 4,
    power: 4000,
    life: null,
    counter: 1000,
    keywords: [],
    effects: [
      {
        trigger: 'OnKO',
        effect: { kind: 'banish', target: { kind: 'opponentCharacter' } },
      },
    ],
    manualText: null,
  },

  'TEST-CHAR-TRIGGER-DRAW': {
    id: 'TEST-CHAR-TRIGGER-DRAW',
    type: 'CHARACTER',
    colors: ['Red'],
    cost: 2,
    power: 3000,
    life: null,
    counter: 1000,
    keywords: [],
    effects: [
      {
        trigger: 'Trigger',
        effect: { kind: 'draw', amount: 1 },
      },
    ],
    manualText: null,
  },

  'TEST-EVENT-KO': {
    id: 'TEST-EVENT-KO',
    type: 'EVENT',
    colors: ['Red'],
    cost: 4,
    power: null,
    life: null,
    counter: null,
    keywords: [],
    effects: [
      {
        trigger: 'OnPlay',
        effect: { kind: 'ko', target: { kind: 'opponentCharacter' } },
      },
    ],
    manualText: null,
  },

  'TEST-EVENT-POWER-UP': {
    id: 'TEST-EVENT-POWER-UP',
    type: 'EVENT',
    colors: ['Red'],
    cost: 1,
    power: null,
    life: null,
    counter: null,
    keywords: [],
    effects: [
      {
        trigger: 'OnPlay',
        effect: {
          kind: 'power',
          target: { kind: 'self' },
          delta: 2000,
          duration: 'thisTurn',
        },
      },
    ],
    manualText: null,
  },

  'TEST-STAGE-01': {
    id: 'TEST-STAGE-01',
    type: 'STAGE',
    colors: ['Red'],
    cost: 2,
    power: null,
    life: null,
    counter: null,
    keywords: [],
    effects: [],
    manualText: null,
  },
};
