import { drawN, donAtLeast } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [DON!! x1] [When Attacking]/[On Block] Draw 1 card if you have 5 or less cards in your hand.
export const effects: TriggeredEffect[] = [
  { trigger: 'OnAttack', condition: donAtLeast(1), effect: drawN(1) },
];
