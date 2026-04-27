import { activateMain, searchEffect } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [Activate: Main] ➀ You may rest this Character: Look at 5 cards from the top of your deck; reveal up to 1 {Land of Wano} type card and add it to your hand.
export const effects: TriggeredEffect[] = [
  activateMain(1, searchEffect('deck', { type: 'CHARACTER' }, 1)),
];
