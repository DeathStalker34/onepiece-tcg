import { onKo, drawN } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [On K.O.] Draw 1 card.
export const effects: TriggeredEffect[] = [onKo(drawN(1))];
