import { trigger, manual } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

export const effects: TriggeredEffect[] = [trigger(manual('Play this card.'))];
