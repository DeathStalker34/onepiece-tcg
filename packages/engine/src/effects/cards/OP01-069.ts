import { onKo, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [On K.O.] Play up to 1 [Smiley] from your deck, then shuffle your deck.
export const effects: TriggeredEffect[] = [
  onKo(manual('Play up to 1 [Smiley] from your deck, then shuffle your deck.')),
];
