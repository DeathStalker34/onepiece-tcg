import { onKo, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [On K.O.] Play up to 1 [Pacifista] with a cost of 4 or less from your hand.
export const effects: TriggeredEffect[] = [
  onKo(manual('Play up to 1 [Pacifista] with a cost of 4 or less from your hand.')),
];
