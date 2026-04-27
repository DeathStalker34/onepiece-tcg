import type { TriggeredEffect } from '../../types/card';

// [DON!! x1] This Character can also attack your opponent's active Characters.
export const effects: TriggeredEffect[] = [
  {
    trigger: 'StaticAura',
    condition: { attachedDonAtLeast: 1 },
    effect: {
      kind: 'manual',
      text: "This Character can also attack your opponent's active Characters.",
    },
  },
];
