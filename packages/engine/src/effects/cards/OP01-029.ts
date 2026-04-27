import { onPlay, powerDelta, self } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [Counter] Up to 1 of your Leader or Character cards gains +2000 power during this battle. Then, if you have 2 or less Life cards, that card gains an additional +2000 power.
export const effects: TriggeredEffect[] = [onPlay(powerDelta(self(), 2000, 'thisTurn', true))];
