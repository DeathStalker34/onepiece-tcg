import { searchEffect, donAtLeast } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [DON!! x1] [When Attacking] Look at 5 cards from the top of your deck; reveal up to 1 {Baroque Works} type Event card and add it to your hand.
export const effects: TriggeredEffect[] = [
  {
    trigger: 'OnAttack',
    condition: donAtLeast(1),
    effect: searchEffect('deck', { type: 'EVENT' }, 1),
  },
];
