import { onPlay, ko, opponentChar, costLte, sequence } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [On Play] DON!! −2: K.O. up to 1 of your opponent's Characters with a cost of 3 or less and up to 1 of your opponent's Characters with a cost of 2 or less.
export const effects: TriggeredEffect[] = [
  onPlay(sequence(ko(opponentChar(costLte(3)), true), ko(opponentChar(costLte(2)), true))),
];
