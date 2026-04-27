import type { GameState, PlayerIndex, TargetRef } from '../types/state';
import type { Effect, TargetSpec, CardFilter, CardStatic } from '../types/card';

interface Context {
  sourcePlayer: PlayerIndex;
  sourceCardId: string;
}

function otherPlayer(p: PlayerIndex): PlayerIndex {
  return p === 0 ? 1 : 0;
}

function matchesFilter(card: CardStatic, filter: CardFilter | undefined): boolean {
  if (!filter) return true;
  if (filter.type && card.type !== filter.type) return false;
  if (filter.colors && filter.colors.length > 0) {
    if (!filter.colors.some((c) => card.colors.includes(c))) return false;
  }
  if (filter.costMin !== undefined && (card.cost ?? 0) < filter.costMin) return false;
  if (filter.costMax !== undefined && (card.cost ?? 0) > filter.costMax) return false;
  if (filter.powerMin !== undefined && (card.power ?? 0) < filter.powerMin) return false;
  if (filter.powerMax !== undefined && (card.power ?? 0) > filter.powerMax) return false;
  if (filter.keyword && !card.keywords.includes(filter.keyword)) return false;
  return true;
}

function targetsForSpec(state: GameState, ctx: Context, spec: TargetSpec): TargetRef[] {
  if (spec.kind === 'self') {
    return [{ kind: 'Leader', owner: ctx.sourcePlayer }];
  }
  if (spec.kind === 'opponentLeader') {
    return [{ kind: 'Leader', owner: otherPlayer(ctx.sourcePlayer) }];
  }
  if (spec.kind === 'opponentCharacter') {
    const opp = otherPlayer(ctx.sourcePlayer);
    return state.players[opp].characters
      .filter((c) => {
        const card = state.catalog[c.cardId];
        return card && matchesFilter(card, spec.filter);
      })
      .map((c) => ({ kind: 'Character' as const, instanceId: c.instanceId, owner: opp }));
  }
  if (spec.kind === 'ownCharacter') {
    const own = ctx.sourcePlayer;
    return state.players[own].characters
      .filter((c) => {
        const card = state.catalog[c.cardId];
        return card && matchesFilter(card, spec.filter);
      })
      .map((c) => ({ kind: 'Character' as const, instanceId: c.instanceId, owner: own }));
  }
  return [];
}

export function validTargetsForEffect(state: GameState, ctx: Context, effect: Effect): TargetRef[] {
  switch (effect.kind) {
    case 'ko':
    case 'banish':
    case 'returnToHand':
    case 'power':
      return targetsForSpec(state, ctx, effect.target);
    default:
      return [];
  }
}
