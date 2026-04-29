import { returnToHand, opponentChar, costLte, donAtLeast } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [DON!! x1] [When Attacking] You may trash 1 card from your hand: Return up to 1 of your opponent's Characters with a cost of 3 or less to the owner's hand.
export const effects: TriggeredEffect[] = [
  {
    trigger: 'OnAttack',
    condition: donAtLeast(1),
    effect: returnToHand(opponentChar(costLte(3)), true),
  },
];
