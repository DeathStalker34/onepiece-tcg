import { onPlay, searchEffect } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [On Play] Look at 5 cards from the top of your deck; reveal up to 1 {Straw Hat Crew} type card other than [Nami] and add it to your hand.
export const effects: TriggeredEffect[] = [onPlay(searchEffect('deck', { type: 'CHARACTER' }, 1))];
