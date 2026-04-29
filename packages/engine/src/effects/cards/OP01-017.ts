import { ko, opponentChar, powerLte, donAtLeast } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

export const effects: TriggeredEffect[] = [
  { trigger: 'OnAttack', condition: donAtLeast(1), effect: ko(opponentChar(powerLte(3000)), true) },
];
