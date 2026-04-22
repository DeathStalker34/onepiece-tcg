import { nextInt } from '@optcg/engine';
import { generateMainActions, generatePriorityAction } from './action-generator';
import type { Bot, BotDecision } from './types';

export const EasyBot: Bot = {
  id: 'easy',
  name: 'Easy',
  pick(state, player, rng): BotDecision {
    const priority = generatePriorityAction(state, player);
    if (priority) return { action: priority, rng };

    if (state.phase === 'Main' && state.activePlayer === player && state.priorityWindow === null) {
      const actions = generateMainActions(state, player);
      if (actions.length === 0) {
        return { action: { kind: 'EndTurn', player }, rng };
      }
      const { value: idx, rng: next } = nextInt(rng, actions.length);
      return { action: actions[idx], rng: next };
    }

    // Refresh/Draw/Don → PassPhase fallback
    return { action: { kind: 'PassPhase', player }, rng };
  },
};
