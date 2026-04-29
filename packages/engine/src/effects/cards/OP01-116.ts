import { onPlay, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [Main] Look at 5 cards from the top of your deck; play up to 1 {SMILE} type Character card with a cost of 3 or less.
export const effects: TriggeredEffect[] = [
  onPlay(
    manual(
      'Look at 5 cards from the top of your deck; play up to 1 {SMILE} type Character card with a cost of 3 or less from the top 5.',
    ),
  ),
];
