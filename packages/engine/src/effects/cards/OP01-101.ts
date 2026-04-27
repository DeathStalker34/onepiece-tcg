import { manual, donAtLeast } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [DON!! x1] [When Attacking] You may trash 1 card from your hand: Add up to 1 DON!! card from your DON!! deck and rest it.
export const effects: TriggeredEffect[] = [
  {
    trigger: 'OnAttack',
    condition: donAtLeast(1),
    effect: manual(
      'You may trash 1 card from your hand: Add up to 1 DON!! card from your DON!! deck and rest it.',
    ),
  },
];
