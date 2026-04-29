import type { Action, GameState, PlayerIndex } from '@optcg/engine';
import { apply } from '@optcg/engine';
import type { DragIntent, DropIntent } from './ids';
import { formatDropId } from './ids';

export type LegalCheck = (action: Action) => boolean;

/**
 * Build a candidate Action from drag+drop intents + game state context.
 * Pure shape construction — does NOT validate legality.
 * Returns null if the intent pair doesn't translate to a known action shape.
 */
export function buildAction(
  drag: DragIntent,
  drop: DropIntent,
  state: GameState,
  localPlayer: PlayerIndex,
): Action | null {
  if (drag.kind === 'hand' && drop.kind === 'field') {
    const cardId = state.players[localPlayer].hand[drag.handIndex];
    if (!cardId) return null;
    const card = state.catalog[cardId];
    if (!card) return null;
    if (card.type === 'CHARACTER') {
      return {
        kind: 'PlayCharacter',
        player: localPlayer,
        handIndex: drag.handIndex,
        donSpent: 0,
      };
    }
    if (card.type === 'EVENT') {
      return {
        kind: 'PlayEvent',
        player: localPlayer,
        handIndex: drag.handIndex,
        donSpent: 0,
      };
    }
    if (card.type === 'STAGE') {
      return {
        kind: 'PlayStage',
        player: localPlayer,
        handIndex: drag.handIndex,
        donSpent: 0,
      };
    }
    return null;
  }
  if (drag.kind === 'don' && drop.kind === 'friendly-leader') {
    return { kind: 'AttachDon', player: localPlayer, target: { kind: 'Leader' } };
  }
  if (drag.kind === 'don' && drop.kind === 'friendly-char') {
    return {
      kind: 'AttachDon',
      player: localPlayer,
      target: { kind: 'Character', instanceId: drop.instanceId },
    };
  }
  if (drag.kind === 'attacker-leader' && drop.kind === 'enemy-leader') {
    return {
      kind: 'DeclareAttack',
      player: localPlayer,
      attacker: { kind: 'Leader' },
      target: { kind: 'Leader' },
    };
  }
  if (drag.kind === 'attacker-leader' && drop.kind === 'enemy-char') {
    return {
      kind: 'DeclareAttack',
      player: localPlayer,
      attacker: { kind: 'Leader' },
      target: { kind: 'Character', instanceId: drop.instanceId, owner: drop.owner },
    };
  }
  if (drag.kind === 'attacker-char' && drop.kind === 'enemy-leader') {
    return {
      kind: 'DeclareAttack',
      player: localPlayer,
      attacker: { kind: 'Character', instanceId: drag.instanceId },
      target: { kind: 'Leader' },
    };
  }
  if (drag.kind === 'attacker-char' && drop.kind === 'enemy-char') {
    return {
      kind: 'DeclareAttack',
      player: localPlayer,
      attacker: { kind: 'Character', instanceId: drag.instanceId },
      target: { kind: 'Character', instanceId: drop.instanceId, owner: drop.owner },
    };
  }
  return null;
}

/**
 * Resolve a drop event to an Action. Returns the action only if `isLegal` accepts it.
 */
export function resolveDrop(
  drag: DragIntent,
  drop: DropIntent | null,
  state: GameState,
  localPlayer: PlayerIndex,
  isLegal: LegalCheck,
): Action | null {
  if (drop === null) return null;
  const action = buildAction(drag, drop, state, localPlayer);
  if (!action) return null;
  return isLegal(action) ? action : null;
}

/**
 * Enumerate the drop ids that would lead to a legal action for the active drag.
 */
export function computeValidDropIds(
  drag: DragIntent | null,
  state: GameState,
  localPlayer: PlayerIndex,
  isLegal: LegalCheck,
): Set<string> {
  const ids = new Set<string>();
  if (drag === null) return ids;
  const opponent: PlayerIndex = localPlayer === 0 ? 1 : 0;

  const candidates: DropIntent[] = [];
  if (drag.kind === 'hand') {
    candidates.push({ kind: 'field' });
  } else if (drag.kind === 'don') {
    candidates.push({ kind: 'friendly-leader' });
    for (const c of state.players[localPlayer].characters) {
      candidates.push({ kind: 'friendly-char', instanceId: c.instanceId });
    }
  } else if (drag.kind === 'attacker-leader' || drag.kind === 'attacker-char') {
    candidates.push({ kind: 'enemy-leader', owner: opponent });
    for (const c of state.players[opponent].characters) {
      candidates.push({ kind: 'enemy-char', instanceId: c.instanceId, owner: opponent });
    }
  }

  for (const drop of candidates) {
    const action = buildAction(drag, drop, state, localPlayer);
    if (action && isLegal(action)) {
      ids.add(formatDropId(drop));
    }
  }
  return ids;
}

/**
 * Convenience: probe the engine to determine action legality.
 */
export function makeLegalCheck(state: GameState): LegalCheck {
  return (action: Action) => !apply(state, action).error;
}
