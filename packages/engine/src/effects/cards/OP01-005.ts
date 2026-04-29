import { onPlay, searchEffect, color } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [On Play] Add up to 1 red Character card other than [Uta] with a cost of 3 or less from your trash to your hand.
export const effects: TriggeredEffect[] = [
  onPlay(searchEffect('trash', { ...color('red'), costMax: 3, type: 'CHARACTER' }, 1)),
];
