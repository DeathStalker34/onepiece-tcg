import { onPlay, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [Counter] Play up to 1 {Baroque Works} type Character card with a cost of 3 or less from your hand.
export const effects: TriggeredEffect[] = [
  onPlay(
    manual(
      'Play up to 1 {Baroque Works} type Character card with a cost of 3 or less from your hand.',
    ),
  ),
];
