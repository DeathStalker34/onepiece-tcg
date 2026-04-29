import { onPlay, ko, opponentChar, costLte } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [Main] K.O. up to 2 of your opponent's rested Characters with a cost of 5 or less.
export const effects: TriggeredEffect[] = [onPlay(ko(opponentChar(costLte(5)), true))];
