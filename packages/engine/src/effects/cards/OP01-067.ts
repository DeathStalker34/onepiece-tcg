import { manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [Banish] [DON!! x1] Give blue Events in your hand −1 cost.
export const effects: TriggeredEffect[] = [
  {
    trigger: 'StaticAura',
    condition: { attachedDonAtLeast: 1 },
    effect: manual('Give blue Events in your hand −1 cost.'),
  },
];
