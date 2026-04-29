import { onPlay, sequence, powerDelta, self, ko, opponentChar, powerLte } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [Counter] Up to 1 of your Leader or Character cards gains +4000 power during this battle. Then, K.O. up to 1 of your opponent's Characters with 4000 power or less.
export const effects: TriggeredEffect[] = [
  onPlay(
    sequence(powerDelta(self(), 4000, 'thisTurn', true), ko(opponentChar(powerLte(4000)), true)),
  ),
];
