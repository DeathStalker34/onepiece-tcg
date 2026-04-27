import { onKo, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [On K.O.] If your Leader has the {Baroque Works} type, add up to 1 Event from your trash to your hand.
export const effects: TriggeredEffect[] = [
  onKo(
    manual(
      'If your Leader has the {Baroque Works} type, add up to 1 Event from your trash to your hand.',
    ),
  ),
];
