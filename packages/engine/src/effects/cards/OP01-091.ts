import { staticAura, powerDelta, opponentChar } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [Your Turn] If you have 10 DON!! cards on your field, give all of your opponent's Characters −1000 power.
export const effects: TriggeredEffect[] = [
  staticAura({ onTurn: 'yours' }, powerDelta(opponentChar(), -1000, 'permanent')),
];
