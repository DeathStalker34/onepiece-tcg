import { onPlay, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [On Play] If you don't have [Penguin], play up to 1 [Penguin] from your hand.
export const effects: TriggeredEffect[] = [
  onPlay(manual("If you don't have [Penguin], play up to 1 [Penguin] from your hand.")),
];
