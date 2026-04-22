import type { Action, GameState, PlayerIndex } from '@optcg/engine';
import { generateMainActions } from './action-generator';
import type { Bot, BotDecision } from './types';

function scoreAction(a: Action, state: GameState, player: PlayerIndex): number {
  switch (a.kind) {
    case 'DeclareAttack': {
      const base = 100;
      const bonusLeader = a.target.kind === 'Leader' ? 50 : 0;
      return base + bonusLeader;
    }
    case 'PlayCharacter': {
      const p = state.players[player];
      const cardId = p.hand[a.handIndex];
      const card = cardId ? state.catalog[cardId] : null;
      const power = card?.power ?? 0;
      return 40 + Math.floor(power / 1000);
    }
    case 'ActivateMain':
      return 30;
    case 'PlayEvent':
      return 25;
    case 'AttachDon':
      return 15;
    case 'PlayStage':
      return 10;
    case 'EndTurn':
      return 0;
    default:
      return 0;
  }
}

function pickPriorityAction(state: GameState, player: PlayerIndex): Action | null {
  const pw = state.priorityWindow;
  if (!pw) return null;

  if (pw.kind === 'Mulligan' && pw.player === player) {
    return { kind: 'Mulligan', player, mulligan: false };
  }

  if (pw.kind === 'CounterStep' && pw.defender.owner === player) {
    const p = state.players[player];
    let bestIdx = -1;
    let bestCounter = 0;
    for (let i = 0; i < p.hand.length; i += 1) {
      const card = state.catalog[p.hand[i]];
      if (!card || card.counter === null || card.counter <= 0) continue;
      if (card.counter > bestCounter) {
        bestCounter = card.counter;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && pw.defender.defensePower + bestCounter >= pw.attacker.attackPower) {
      return { kind: 'PlayCounter', player, handIndex: bestIdx };
    }
    return { kind: 'DeclineCounter', player };
  }

  if (pw.kind === 'BlockerStep' && pw.originalTarget.owner === player) {
    const p = state.players[player];
    if (pw.originalTarget.target.kind === 'Leader' && p.life.length <= 1) {
      const blocker = p.characters.find((c) => {
        const card = state.catalog[c.cardId];
        return !c.rested && !c.usedBlockerThisTurn && card?.keywords.includes('Blocker');
      });
      if (blocker) {
        return { kind: 'UseBlocker', player, blockerInstanceId: blocker.instanceId };
      }
    }
    return { kind: 'DeclineBlocker', player };
  }

  if (pw.kind === 'TriggerStep' && pw.owner === player) {
    const activate = pw.triggerEffect.kind !== 'manual';
    return { kind: 'ActivateTrigger', player, activate };
  }

  return null;
}

export const MediumBot: Bot = {
  id: 'medium',
  name: 'Medium',
  pick(state, player, rng): BotDecision {
    const priority = pickPriorityAction(state, player);
    if (priority) return { action: priority, rng };

    if (state.phase === 'Main' && state.activePlayer === player && state.priorityWindow === null) {
      const actions = generateMainActions(state, player);
      if (actions.length === 0) {
        return { action: { kind: 'EndTurn', player }, rng };
      }
      let best: Action = actions[0];
      let bestScore = scoreAction(best, state, player);
      for (const a of actions) {
        const s = scoreAction(a, state, player);
        if (s > bestScore) {
          best = a;
          bestScore = s;
        }
      }
      return { action: best, rng };
    }

    return { action: { kind: 'PassPhase', player }, rng };
  },
};
