import type { TriggeredEffect } from '../../types/card';

// [On Block] DON!! −1: This Character gains +1000 power during this turn.
export const effects: TriggeredEffect[] = [
  {
    trigger: 'StaticAura',
    effect: {
      kind: 'manual',
      text: '[On Block] DON!! −1: This Character gains +1000 power during this turn.',
    },
  },
];
