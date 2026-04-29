import { onPlay, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [On Play] If you don't have [Shachi], play up to 1 [Shachi] from your hand.
export const effects: TriggeredEffect[] = [
  onPlay(manual("If you don't have [Shachi], play up to 1 [Shachi] from your hand.")),
];
