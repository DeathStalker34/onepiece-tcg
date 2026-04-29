import { onPlay, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [On Play] Rest up to 1 of your opponent's Characters with a cost of 4 or less.
export const effects: TriggeredEffect[] = [
  onPlay(manual("Rest up to 1 of your opponent's Characters with a cost of 4 or less.")),
];
