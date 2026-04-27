import { staticAura, donAtLeast, self, powerDelta } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [DON!! x2] [Opponent's Turn] This Character gains +3000 power.
export const effects: TriggeredEffect[] = [
  staticAura({ onTurn: 'opponents', ...donAtLeast(2) }, powerDelta(self(), 3000, 'permanent')),
];
