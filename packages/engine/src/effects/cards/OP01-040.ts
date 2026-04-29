import { onPlay, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [On Play] If your Leader is [Kouzuki Oden], play up to 1 {The Akazaya Nine} type Character card with a cost of 3 or less from your hand.
export const effects: TriggeredEffect[] = [
  onPlay(
    manual(
      'If your Leader is [Kouzuki Oden], play up to 1 {The Akazaya Nine} type Character card with a cost of 3 or less from your hand.',
    ),
  ),
];
