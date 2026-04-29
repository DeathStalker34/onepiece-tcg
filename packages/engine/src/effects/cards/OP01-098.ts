import { onPlay, searchEffect } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [On Play] Reveal up to 1 [Artificial Devil Fruit SMILE] from your deck and add it to your hand. Then, shuffle your deck.
export const effects: TriggeredEffect[] = [onPlay(searchEffect('deck', { type: 'EVENT' }, 1))];
