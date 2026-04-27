import { onPlay, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [On Play] Look at 5 cards from the top of your deck and place them at the top or bottom of the deck in any order.
export const effects: TriggeredEffect[] = [
  onPlay(
    manual(
      'Look at 5 cards from the top of your deck and place them at the top or bottom of the deck in any order.',
    ),
  ),
];
