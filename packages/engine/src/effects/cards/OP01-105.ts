import { onPlay, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [On Play] Choose 2 cards from your opponent's hand; your opponent reveals those cards.
export const effects: TriggeredEffect[] = [
  onPlay(manual("Choose 2 cards from your opponent's hand; your opponent reveals those cards.")),
];
