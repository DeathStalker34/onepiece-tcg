import { onPlay, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [On Play] Draw 1 card if you have 8 or more DON!! cards on your field.
export const effects: TriggeredEffect[] = [
  onPlay(manual('Draw 1 card if you have 8 or more DON!! cards on your field.')),
];
