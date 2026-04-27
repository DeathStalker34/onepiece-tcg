import { manual, donAtLeast } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [DON!! x1] [When Attacking] Play up to 1 {Heart Pirates} type Character card other than [Bepo] with a cost of 4 or less from your hand.
export const effects: TriggeredEffect[] = [
  {
    trigger: 'OnAttack',
    condition: donAtLeast(1),
    effect: manual(
      'Play up to 1 {Heart Pirates} type Character card other than [Bepo] with a cost of 4 or less from your hand.',
    ),
  },
];
