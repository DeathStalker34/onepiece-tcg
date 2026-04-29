import { staticAura } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [Your Turn] This Character gains [Double Attack] if you have 5 or more cards in your hand.
export const effects: TriggeredEffect[] = [
  staticAura(
    { onTurn: 'yours' },
    {
      kind: 'manual',
      text: 'This Character gains [Double Attack] if you have 5 or more cards in your hand.',
    },
  ),
];
