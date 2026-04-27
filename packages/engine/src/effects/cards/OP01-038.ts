import { onKo, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [DON!! x1] [When Attacking] K.O. up to 1 of your opponent's rested Characters with a cost of 2 or less.
// [On K.O.] Your opponent chooses 1 card from your hand; trash that card.
export const effects: TriggeredEffect[] = [
  {
    trigger: 'OnAttack',
    condition: { attachedDonAtLeast: 1 },
    effect: {
      kind: 'manual',
      text: "K.O. up to 1 of your opponent's rested Characters with a cost of 2 or less.",
    },
  },
  onKo(manual('Your opponent chooses 1 card from your hand; trash that card.')),
];
