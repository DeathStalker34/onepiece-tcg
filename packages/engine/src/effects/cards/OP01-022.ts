import { powerDelta, opponentChar, donAtLeast } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [DON!! x1] [When Attacking] Give up to 2 of your opponent's Characters −2000 power during this turn.
export const effects: TriggeredEffect[] = [
  {
    trigger: 'OnAttack',
    condition: donAtLeast(1),
    effect: powerDelta(opponentChar(), -2000, 'thisTurn', true),
  },
];
