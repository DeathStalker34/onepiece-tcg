import { onPlay, sequence, powerDelta, self, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [Counter] Up to 1 of your Leader or Character cards gains +2000 power during this battle. Then, look at 3 cards from the top of your deck and place them at the top or bottom of the deck in any order.
export const effects: TriggeredEffect[] = [
  onPlay(
    sequence(
      powerDelta(self(), 2000, 'thisTurn', true),
      manual(
        'Look at 3 cards from the top of your deck and place them at the top or bottom of the deck in any order.',
      ),
    ),
  ),
];
