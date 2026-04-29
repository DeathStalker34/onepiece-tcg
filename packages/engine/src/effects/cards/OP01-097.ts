import { onPlay, powerDelta, opponentChar, sequence } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [On Play] DON!! −1: This Character gains [Rush] during this turn. Then, give up to 1 of your opponent's Characters −2000 power during this turn.
export const effects: TriggeredEffect[] = [
  onPlay(sequence(powerDelta(opponentChar(), -2000, 'thisTurn', true))),
];
