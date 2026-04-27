import { staticAura } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

// {Kurozumi Clan} type Characters other than your [Kurozumi Semimaru] cannot be K.O.'d in battle.
export const effects: TriggeredEffect[] = [
  staticAura(
    {},
    {
      kind: 'manual',
      text: "{Kurozumi Clan} type Characters other than your [Kurozumi Semimaru] cannot be K.O.'d in battle.",
    },
  ),
];
