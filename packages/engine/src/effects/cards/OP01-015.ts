import { searchEffect, donAtLeast } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// [DON!! x1] [When Attacking] You may trash 1 card from your hand: Add up to 1 {Straw Hat Crew} type Character card other than [Tony Tony.Chopper] with a cost of 4 or less from your trash to your hand.
export const effects: TriggeredEffect[] = [
  {
    trigger: 'OnAttack',
    condition: donAtLeast(1),
    effect: searchEffect('trash', { type: 'CHARACTER', costMax: 4 }, 1),
  },
];
