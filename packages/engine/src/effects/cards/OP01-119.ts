import { onPlay, sequence, powerDelta, self, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [Counter] Up to 1 of your Leader or Character cards gains +4000 power during this battle. Then, if you have 2 or less Life cards, add up to 1 DON!! card from your DON!! deck and rest it.
export const effects: TriggeredEffect[] = [
  onPlay(
    sequence(
      powerDelta(self(), 4000, 'thisTurn', true),
      manual(
        'If you have 2 or less Life cards, add up to 1 DON!! card from your DON!! deck and rest it.',
      ),
    ),
  ),
];
