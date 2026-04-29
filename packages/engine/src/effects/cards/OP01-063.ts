import { manual, donAtLeast } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [DON!! x1] [Activate: Main] You may rest this Character: Choose 1 card from your opponent's hand; your opponent reveals that card.
export const effects: TriggeredEffect[] = [
  {
    trigger: 'Activate:Main',
    condition: donAtLeast(1),
    effect: manual(
      "Choose 1 card from your opponent's hand; your opponent reveals that card. If the revealed card is an Event, place up to 1 card from your opponent's Life area at the bottom of the owner's deck.",
    ),
  },
];
