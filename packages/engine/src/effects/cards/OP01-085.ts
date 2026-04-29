import { onPlay, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [On Play] If your Leader has the {Baroque Works} type, select up to 1 of your opponent's Characters with a cost of 4 or less. The selected Character cannot attack until the end of your opponent's next turn.
export const effects: TriggeredEffect[] = [
  onPlay(
    manual(
      "If your Leader has the {Baroque Works} type, select up to 1 of your opponent's Characters with a cost of 4 or less. The selected Character cannot attack until the end of your opponent's next turn.",
    ),
  ),
];
