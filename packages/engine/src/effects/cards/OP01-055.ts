import { onPlay, drawN } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [Main] You may rest 2 of your Characters: Draw 2 cards.
export const effects: TriggeredEffect[] = [onPlay(drawN(2))];
