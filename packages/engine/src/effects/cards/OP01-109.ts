import { staticAura, donAtLeast } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [DON!! x1] [Your Turn] If you have 8 or more DON!! cards on your field, this Character gains +1000 power.
export const effects: TriggeredEffect[] = [
  staticAura(
    { onTurn: 'yours', ...donAtLeast(1) },
    {
      kind: 'manual',
      text: 'If you have 8 or more DON!! cards on your field, this Character gains +1000 power.',
    },
  ),
];
