import type { Action, GameState, PlayerIndex } from '@optcg/engine';
import { computeLegalActions } from '@optcg/engine';
import type { DragIntent, DropIntent } from './ids';
import { formatDropId } from './ids';

export function resolveDrop(
  drag: DragIntent,
  drop: DropIntent | null,
  legalActions: Action[],
): Action | null {
  if (drop === null) return null;

  for (const action of legalActions) {
    // Hand → field
    if (drag.kind === 'hand' && drop.kind === 'field') {
      if (
        (action.kind === 'PlayCharacter' ||
          action.kind === 'PlayEvent' ||
          action.kind === 'PlayStage') &&
        action.handIndex === drag.handIndex
      ) {
        return action;
      }
    }
    // DON → friendly leader
    if (drag.kind === 'don' && drop.kind === 'friendly-leader') {
      if (action.kind === 'AttachDon' && action.target.kind === 'Leader') return action;
    }
    // DON → friendly character
    if (drag.kind === 'don' && drop.kind === 'friendly-char') {
      if (
        action.kind === 'AttachDon' &&
        action.target.kind === 'Character' &&
        action.target.instanceId === drop.instanceId
      ) {
        return action;
      }
    }
    // Leader attacker → enemy leader
    if (drag.kind === 'attacker-leader' && drop.kind === 'enemy-leader') {
      if (
        action.kind === 'DeclareAttack' &&
        action.attacker.kind === 'Leader' &&
        action.target.kind === 'Leader'
      ) {
        return action;
      }
    }
    // Leader attacker → enemy character
    if (drag.kind === 'attacker-leader' && drop.kind === 'enemy-char') {
      if (
        action.kind === 'DeclareAttack' &&
        action.attacker.kind === 'Leader' &&
        action.target.kind === 'Character' &&
        action.target.instanceId === drop.instanceId
      ) {
        return action;
      }
    }
    // Character attacker → enemy leader
    if (drag.kind === 'attacker-char' && drop.kind === 'enemy-leader') {
      if (
        action.kind === 'DeclareAttack' &&
        action.attacker.kind === 'Character' &&
        action.attacker.instanceId === drag.instanceId &&
        action.target.kind === 'Leader'
      ) {
        return action;
      }
    }
    // Character attacker → enemy character
    if (drag.kind === 'attacker-char' && drop.kind === 'enemy-char') {
      if (
        action.kind === 'DeclareAttack' &&
        action.attacker.kind === 'Character' &&
        action.attacker.instanceId === drag.instanceId &&
        action.target.kind === 'Character' &&
        action.target.instanceId === drop.instanceId
      ) {
        return action;
      }
    }
  }
  return null;
}

export function computeValidDropIds(
  drag: DragIntent | null,
  legalActions: Action[],
  localPlayer: PlayerIndex,
): Set<string> {
  const ids = new Set<string>();
  if (drag === null) return ids;

  const opponent: PlayerIndex = localPlayer === 0 ? 1 : 0;

  for (const action of legalActions) {
    if (drag.kind === 'hand') {
      if (
        (action.kind === 'PlayCharacter' ||
          action.kind === 'PlayEvent' ||
          action.kind === 'PlayStage') &&
        action.handIndex === drag.handIndex
      ) {
        ids.add(formatDropId({ kind: 'field' }));
      }
    } else if (drag.kind === 'don') {
      if (action.kind === 'AttachDon') {
        if (action.target.kind === 'Leader') {
          ids.add(formatDropId({ kind: 'friendly-leader' }));
        } else {
          ids.add(formatDropId({ kind: 'friendly-char', instanceId: action.target.instanceId }));
        }
      }
    } else if (drag.kind === 'attacker-leader') {
      if (action.kind === 'DeclareAttack' && action.attacker.kind === 'Leader') {
        if (action.target.kind === 'Leader') {
          ids.add(formatDropId({ kind: 'enemy-leader', owner: opponent }));
        } else {
          ids.add(
            formatDropId({
              kind: 'enemy-char',
              instanceId: action.target.instanceId,
              owner: action.target.owner,
            }),
          );
        }
      }
    } else if (drag.kind === 'attacker-char') {
      if (
        action.kind === 'DeclareAttack' &&
        action.attacker.kind === 'Character' &&
        action.attacker.instanceId === drag.instanceId
      ) {
        if (action.target.kind === 'Leader') {
          ids.add(formatDropId({ kind: 'enemy-leader', owner: opponent }));
        } else {
          ids.add(
            formatDropId({
              kind: 'enemy-char',
              instanceId: action.target.instanceId,
              owner: action.target.owner,
            }),
          );
        }
      }
    }
  }
  return ids;
}

export function getLegalActions(state: GameState): Action[] {
  return computeLegalActions(state);
}
