import { onKo, ko, opponentChar, powerLte } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

export const effects: TriggeredEffect[] = [onKo(ko(opponentChar(powerLte(4000)), true))];
