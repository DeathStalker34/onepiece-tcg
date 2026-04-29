import { manual, donAtLeast } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [DON!! x1] [When Attacking] If your Leader is [Kouzuki Oden], set up to 2 of your DON!! cards as active.
export const effects: TriggeredEffect[] = [
  {
    trigger: 'OnAttack',
    condition: donAtLeast(1),
    effect: manual('If your Leader is [Kouzuki Oden], set up to 2 of your DON!! cards as active.'),
  },
];
