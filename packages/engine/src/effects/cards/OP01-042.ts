import { onPlay, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [On Play] ③: If your Leader is [Kouzuki Oden], set up to 1 of your {Land of Wano} type Character cards with a cost of 3 or less as active.
export const effects: TriggeredEffect[] = [
  onPlay(
    manual(
      'If your Leader is [Kouzuki Oden], set up to 1 of your {Land of Wano} type Character cards with a cost of 3 or less as active.',
    ),
  ),
];
