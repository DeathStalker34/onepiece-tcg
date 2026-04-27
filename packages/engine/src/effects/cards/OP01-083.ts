import { staticAura, donAtLeast } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [DON!! x1] [Your Turn] If your Leader has the {Baroque Works} type, this Character gains +1000 power for every 2 Events in your trash.
export const effects: TriggeredEffect[] = [
  staticAura(
    { onTurn: 'yours', ...donAtLeast(1) },
    {
      kind: 'manual',
      text: 'If your Leader has the {Baroque Works} type, this Character gains +1000 power for every 2 Events in your trash.',
    },
  ),
];
