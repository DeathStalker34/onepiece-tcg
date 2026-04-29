import { manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [Rush] (This card can attack on the turn in which it is played.)
export const effects: TriggeredEffect[] = [{ trigger: 'StaticAura', effect: manual('[Rush]') }];
