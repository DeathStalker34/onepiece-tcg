import { onPlay, powerDelta, opponentChar } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [Counter] Give up to 1 of your Leader or Character cards −2000 power during this turn.
export const effects: TriggeredEffect[] = [
  onPlay(powerDelta(opponentChar(), -2000, 'thisTurn', true)),
];
