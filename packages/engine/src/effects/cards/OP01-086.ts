import {
  onPlay,
  sequence,
  powerDelta,
  self,
  returnToHand,
  opponentChar,
  costLte,
} from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [Counter] Up to 1 of your Leader or Character cards gains +4000 power during this battle. Then, return up to 1 active Character with a cost of 3 or less to the owner's hand.
export const effects: TriggeredEffect[] = [
  onPlay(
    sequence(
      powerDelta(self(), 4000, 'thisTurn', true),
      returnToHand(opponentChar(costLte(3)), true),
    ),
  ),
];
