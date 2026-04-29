import { onPlay, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [On Play] Add up to 1 DON!! card from your DON!! deck and rest it.
export const effects: TriggeredEffect[] = [
  onPlay(manual('Add up to 1 DON!! card from your DON!! deck and rest it.')),
];
