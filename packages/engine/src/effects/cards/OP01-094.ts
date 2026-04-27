import { onPlay, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [On Play] DON!! −6: If your Leader has the {Animal Kingdom Pirates} type, K.O. all Characters other than this Character.
export const effects: TriggeredEffect[] = [
  onPlay(
    manual(
      'If your Leader has the {Animal Kingdom Pirates} type, K.O. all Characters other than this Character.',
    ),
  ),
];
