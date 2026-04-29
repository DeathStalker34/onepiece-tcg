import { staticAura, donAtLeast } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [DON!! x1] [Your Turn] This Character gains +1000 power for every card in your hand.
export const effects: TriggeredEffect[] = [
  staticAura(
    { onTurn: 'yours', ...donAtLeast(1) },
    { kind: 'manual', text: 'This Character gains +1000 power for every card in your hand.' },
  ),
];
