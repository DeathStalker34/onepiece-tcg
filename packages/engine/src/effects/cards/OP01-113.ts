import { onKo, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [On K.O.] Add up to 1 DON!! card from your DON!! deck and rest it.
export const effects: TriggeredEffect[] = [
  onKo(manual('Add up to 1 DON!! card from your DON!! deck and rest it.')),
];
