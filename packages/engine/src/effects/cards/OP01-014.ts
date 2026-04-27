import type { TriggeredEffect } from '../../types/card';

// [DON!! x1] [On Block] Play up to 1 red Character card with a cost of 2 or less from your hand.
export const effects: TriggeredEffect[] = [
  {
    trigger: 'StaticAura',
    condition: { attachedDonAtLeast: 1 },
    effect: {
      kind: 'manual',
      text: '[On Block] Play up to 1 red Character card with a cost of 2 or less from your hand.',
    },
  },
];
