import { staticAura, donAtLeast, ownChar, powerDelta } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

export const effects: TriggeredEffect[] = [
  staticAura({ onTurn: 'yours', ...donAtLeast(1) }, powerDelta(ownChar(), 1000, 'permanent')),
];
