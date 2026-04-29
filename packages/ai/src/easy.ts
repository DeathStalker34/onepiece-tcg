import { nextInt } from '@optcg/engine';
import { generateMainActions, generatePriorityAction } from './action-generator';
import type { Bot, BotDecision } from './types';

export const EasyBot: Bot = {
  id: 'easy',
  name: 'Easy',
  pick(state, player, rng): BotDecision {
    const priority = generatePriorityAction(state, player);
    if (priority) return { action: priority, rng };

    if (
      state.priorityWindow?.kind === 'EffectTargetSelection' &&
      state.priorityWindow.sourceOwner === player
    ) {
      const pw = state.priorityWindow;
      const total = pw.validTargets.length + (pw.optional ? 1 : 0);
      const { value: idx, rng: rng2 } = nextInt(rng, total);
      const targetIndex = idx < pw.validTargets.length ? idx : null;
      return {
        action: { kind: 'SelectEffectTarget', player: pw.sourceOwner, targetIndex },
        rng: rng2,
        rationale: `random select target idx=${String(targetIndex)}`,
      };
    }

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
