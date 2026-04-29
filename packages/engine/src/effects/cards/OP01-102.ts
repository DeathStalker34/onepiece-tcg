import { manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [When Attacking] DON!! −1: Your opponent trashes 1 card from their hand.
export const effects: TriggeredEffect[] = [
  { trigger: 'OnAttack', effect: manual('Your opponent trashes 1 card from their hand.') },
];
