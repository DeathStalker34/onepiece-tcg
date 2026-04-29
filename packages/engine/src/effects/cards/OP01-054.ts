import { onPlay, ko, opponentChar, costLte } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [On Play] K.O. up to 1 of your opponent's rested Characters with a cost of 4 or less.
export const effects: TriggeredEffect[] = [onPlay(ko(opponentChar(costLte(4)), true))];
