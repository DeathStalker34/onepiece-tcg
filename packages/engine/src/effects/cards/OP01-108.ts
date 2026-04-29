import { onKo, ko, opponentChar, costLte } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [On K.O.] DON!! −1: K.O. up to 1 of your opponent's Characters with a cost of 5 or less.
export const effects: TriggeredEffect[] = [onKo(ko(opponentChar(costLte(5)), true))];
