import { onPlay, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [On Play] You may return 1 Character to your hand: Play up to 1 Character card with a cost of 3 or less from your hand.
export const effects: TriggeredEffect[] = [
  onPlay(
    manual(
      'You may return 1 Character to your hand: Play up to 1 Character card with a cost of 3 or less from your hand.',
    ),
  ),
];
