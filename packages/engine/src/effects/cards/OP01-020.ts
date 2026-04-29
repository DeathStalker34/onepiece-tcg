import { activateMain, powerDelta, ownChar } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [Activate: Main] You may rest this Character: Up to 1 of your Leader or Character cards gains +2000 power during this turn.
export const effects: TriggeredEffect[] = [
  activateMain(0, powerDelta(ownChar(), 2000, 'thisTurn', true)),
];
