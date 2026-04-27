import { staticAura, donAtLeast, self, powerDelta } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [DON!! x1] If your opponent has 2 or more rested Characters, this Character gains +2000 power.
export const effects: TriggeredEffect[] = [
  staticAura(donAtLeast(1), powerDelta(self(), 2000, 'permanent')),
];
