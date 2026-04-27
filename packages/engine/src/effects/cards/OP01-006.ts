import { onPlay, powerDelta, opponentChar } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

export const effects: TriggeredEffect[] = [
  onPlay(powerDelta(opponentChar(), -2000, 'thisTurn', true)),
];
