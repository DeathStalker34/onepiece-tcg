import { manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [Rush] [When Attacking] Your opponent cannot activate a [Blocker] Character that has 2000 or less power during this battle.
export const effects: TriggeredEffect[] = [
  {
    trigger: 'OnAttack',
    effect: manual(
      'Your opponent cannot activate a [Blocker] Character that has 2000 or less power during this battle.',
    ),
  },
];
