import { onPlay, sequence, powerDelta, self, drawN } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [Counter] DON!! −2: Up to 1 of your Leader or Character cards gains +2000 power during this battle. Then, draw 1 card.
export const effects: TriggeredEffect[] = [
  onPlay(sequence(powerDelta(self(), 2000, 'thisTurn', true), drawN(1))),
];
