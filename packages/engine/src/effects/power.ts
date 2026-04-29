import type { GameState, PlayerIndex, TargetRef } from '../types/state';
import type { CardStatic, Effect, TriggeredEffect } from '../types/card';

function basePowerFor(
  state: GameState,
  ref: TargetRef,
): { card: CardStatic; attachedDon: number; powerThisTurn: number } | null {
  if (ref.kind === 'Leader') {
    const p = state.players[ref.owner];
    const card = state.catalog[p.leader.cardId];
    if (!card) return null;
    return {
      card,
      attachedDon: p.leader.attachedDon,
      powerThisTurn: p.leader.powerThisTurn,
    };
  }
  const p = state.players[ref.owner];
  const c = p.characters.find((x) => x.instanceId === ref.instanceId);
  if (!c) return null;
  const card = state.catalog[c.cardId];
  if (!card) return null;
  return {
    card,
    attachedDon: c.attachedDon,
    powerThisTurn: c.powerThisTurn,
  };
}

function effectMatchesRef(sourceOwner: PlayerIndex, effect: Effect, ref: TargetRef): boolean {
  if (effect.kind !== 'power') return false;
  const target = effect.target;
  if (target.kind === 'self') {
    return ref.kind === 'Leader' && ref.owner === sourceOwner;
  }
  if (target.kind === 'opponentLeader') {
    return ref.kind === 'Leader' && ref.owner !== sourceOwner;
  }
  if (target.kind === 'opponentCharacter') {
    return ref.kind === 'Character' && ref.owner !== sourceOwner;
  }
  if (target.kind === 'ownCharacter') {
    return ref.kind === 'Character' && ref.owner === sourceOwner;
  }
  return false;
}

function conditionHolds(
  state: GameState,
  sourceOwner: PlayerIndex,
  sourceAttachedDon: number,
  te: TriggeredEffect,
): boolean {
  const c = te.condition;
  if (!c) return true;
  if (c.onTurn === 'yours' && state.activePlayer !== sourceOwner) return false;
  if (c.onTurn === 'opponents' && state.activePlayer === sourceOwner) return false;
  if (c.attachedDonAtLeast !== undefined && sourceAttachedDon < c.attachedDonAtLeast) {
    return false;
  }
  return true;
}

function iterateAuraSources(
  state: GameState,
): Array<{ owner: PlayerIndex; cardId: string; attachedDon: number }> {
  const out: Array<{ owner: PlayerIndex; cardId: string; attachedDon: number }> = [];
  for (const owner of [0, 1] as const) {
    const p = state.players[owner];
    out.push({
      owner,
      cardId: p.leader.cardId,
      attachedDon: p.leader.attachedDon,
    });
    for (const c of p.characters) {
      out.push({ owner, cardId: c.cardId, attachedDon: c.attachedDon });
    }
  }
  return out;
}

export function computeEffectivePower(state: GameState, ref: TargetRef): number {
  const base = basePowerFor(state, ref);
  if (!base) return 0;
  let power = (base.card.power ?? 0) + base.attachedDon * 1000 + base.powerThisTurn;
  for (const src of iterateAuraSources(state)) {
    const sourceCard = state.catalog[src.cardId];
    if (!sourceCard) continue;
    for (const te of sourceCard.effects) {
      if (te.trigger !== 'StaticAura') continue;
      if (!conditionHolds(state, src.owner, src.attachedDon, te)) continue;
      if (!effectMatchesRef(src.owner, te.effect, ref)) continue;
      if (te.effect.kind === 'power') power += te.effect.delta;
    }
  }
  return Math.max(0, power);
}
