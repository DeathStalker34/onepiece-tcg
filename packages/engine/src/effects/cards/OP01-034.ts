import { manual, donAtLeast } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [DON!! x2] [When Attacking] Set up to 1 of your DON!! cards as active.
export const effects: TriggeredEffect[] = [
  {
    trigger: 'OnAttack',
    condition: donAtLeast(2),
    effect: manual('Set up to 1 of your DON!! cards as active.'),
  },
];
