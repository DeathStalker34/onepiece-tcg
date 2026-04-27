import { onPlay, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [On Play] Place up to 1 Character with a cost of 7 or less at the bottom of the owner's deck.
export const effects: TriggeredEffect[] = [
  onPlay(
    manual("Place up to 1 Character with a cost of 7 or less at the bottom of the owner's deck."),
  ),
];
