import { onPlay, sequence, powerDelta, self, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [Counter] Up to 1 of your Leader or Character cards gains +4000 power during this battle. Then, rest up to 1 of your opponent's Characters with a cost of 4 or less.
export const effects: TriggeredEffect[] = [
  onPlay(
    sequence(
      powerDelta(self(), 4000, 'thisTurn', true),
      manual("Rest up to 1 of your opponent's Characters with a cost of 4 or less."),
    ),
  ),
];
