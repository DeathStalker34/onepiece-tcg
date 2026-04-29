import { onPlay, returnToHand, opponentChar, costLte } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [Counter] If your Leader has the {The Seven Warlords of the Sea} type, return up to 1 Character with a cost of 5 or less to the owner's hand.
export const effects: TriggeredEffect[] = [onPlay(returnToHand(opponentChar(costLte(5)), true))];
