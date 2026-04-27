import { onPlay, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [On Play] DON!! −1: Your opponent trashes 1 card from their hand.
export const effects: TriggeredEffect[] = [
  onPlay(manual('Your opponent trashes 1 card from their hand.')),
];
