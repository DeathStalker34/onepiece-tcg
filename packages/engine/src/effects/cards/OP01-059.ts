import { onPlay, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [Main] You may trash 1 {Land of Wano} type card from your hand: Set up to 1 of your {Land of Wano} type Character cards with a cost of 3 or less as active.
export const effects: TriggeredEffect[] = [
  onPlay(
    manual(
      'You may trash 1 {Land of Wano} type card from your hand: Set up to 1 of your {Land of Wano} type Character cards with a cost of 3 or less as active.',
    ),
  ),
];
