import { onPlay, powerDelta, opponentChar } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [Main] Give up to 1 of your opponent's Characters −10000 power during this turn.
export const effects: TriggeredEffect[] = [
  onPlay(powerDelta(opponentChar(), -10000, 'thisTurn', true)),
];
