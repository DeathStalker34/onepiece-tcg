import { onPlay, sequence, powerDelta, self, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [Counter] Up to 1 of your Leader or Character cards gains +2000 power during this battle. Then, set up to 1 of your Characters as active.
export const effects: TriggeredEffect[] = [
  onPlay(
    sequence(
      powerDelta(self(), 2000, 'thisTurn', true),
      manual('Set up to 1 of your Characters as active.'),
    ),
  ),
];
