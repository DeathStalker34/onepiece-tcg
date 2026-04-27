import { onPlay, sequence, ko, opponentChar, costLte, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [Main] K.O. up to 1 of your opponent's Characters with a cost of 2 or less, then add up to 1 DON!! card from your DON!! deck and set it as active.
export const effects: TriggeredEffect[] = [
  onPlay(
    sequence(
      ko(opponentChar(costLte(2)), true),
      manual('Add up to 1 DON!! card from your DON!! deck and set it as active.'),
    ),
  ),
];
