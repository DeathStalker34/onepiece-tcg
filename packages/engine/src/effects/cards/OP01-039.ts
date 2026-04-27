import type { TriggeredEffect } from '../../types/card';

// [DON!! x1] [On Block] If you have 3 or more Characters, draw 1 card.
export const effects: TriggeredEffect[] = [
  {
    trigger: 'StaticAura',
    condition: { attachedDonAtLeast: 1 },
    effect: { kind: 'manual', text: '[On Block] If you have 3 or more Characters, draw 1 card.' },
  },
];
