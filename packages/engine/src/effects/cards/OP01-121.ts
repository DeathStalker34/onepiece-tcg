import type { TriggeredEffect } from '../../types/card';

// Also treat this card's name as [Kouzuki Oden]. [Double Attack] [Banish]
export const effects: TriggeredEffect[] = [
  {
    trigger: 'StaticAura',
    effect: {
      kind: 'manual',
      text: "Also treat this card's name as [Kouzuki Oden] according to the rules.",
    },
  },
];
