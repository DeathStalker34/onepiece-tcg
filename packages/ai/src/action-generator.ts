import type { Action, GameState, PlayerIndex } from '@optcg/engine';

export function generatePriorityAction(state: GameState, player: PlayerIndex): Action | null {
  const pw = state.priorityWindow;
  if (!pw) return null;
  if (pw.kind === 'Mulligan' && pw.player === player) {
    return { kind: 'Mulligan', player, mulligan: false };
  }
  if (pw.kind === 'CounterStep' && pw.defender.owner === player) {
    return { kind: 'DeclineCounter', player };
  }
  if (pw.kind === 'BlockerStep' && pw.originalTarget.owner === player) {
    return { kind: 'DeclineBlocker', player };
  }
  if (pw.kind === 'TriggerStep' && pw.owner === player) {
    return { kind: 'ActivateTrigger', player, activate: false };
  }
  return null;
}

export function generateMainActions(state: GameState, player: PlayerIndex): Action[] {
  if (state.phase !== 'Main') return [];
  if (state.activePlayer !== player) return [];
  if (state.priorityWindow !== null) return [];

  const actions: Action[] = [];
  const p = state.players[player];
  const oppIdx: PlayerIndex = player === 0 ? 1 : 0;
  const opp = state.players[oppIdx];

  // Always EndTurn as fallback
  actions.push({ kind: 'EndTurn', player });

  // Play hand cards (donSpent=0 only for MVP)
  const leader = state.catalog[p.leader.cardId];
  for (let i = 0; i < p.hand.length; i += 1) {
    const cardId = p.hand[i];
    const card = state.catalog[cardId];
    if (!card) continue;
    const cost = card.cost ?? 0;
    if (p.donActive < cost) continue;
    const shareColor = leader ? card.colors.some((c) => leader.colors.includes(c)) : false;
    if (!shareColor) continue;

    if (card.type === 'CHARACTER' && p.characters.length < 5) {
      actions.push({ kind: 'PlayCharacter', player, handIndex: i, donSpent: 0 });
    } else if (card.type === 'EVENT') {
      actions.push({ kind: 'PlayEvent', player, handIndex: i, donSpent: 0 });
    } else if (card.type === 'STAGE') {
      actions.push({ kind: 'PlayStage', player, handIndex: i, donSpent: 0 });
    }
  }

  // Attach DON (only if any active)
  if (p.donActive >= 1) {
    actions.push({ kind: 'AttachDon', player, target: { kind: 'Leader' } });
    for (const c of p.characters) {
      actions.push({
        kind: 'AttachDon',
        player,
        target: { kind: 'Character', instanceId: c.instanceId },
      });
    }
  }

  // Declare attack (respect first-turn rule)
  if (p.firstTurnUsed) {
    const attackers: Array<{ kind: 'Leader' } | { kind: 'Character'; instanceId: string }> = [];
    if (!p.leader.rested) attackers.push({ kind: 'Leader' });
    for (const c of p.characters) {
      if (c.rested) continue;
      if (c.summoningSickness) {
        const card = state.catalog[c.cardId];
        if (!card || !card.keywords.includes('Rush')) continue;
      }
      attackers.push({ kind: 'Character', instanceId: c.instanceId });
    }

    const targets: Array<
      { kind: 'Leader' } | { kind: 'Character'; instanceId: string; owner: PlayerIndex }
    > = [{ kind: 'Leader' }];
    for (const c of opp.characters) {
      if (c.rested) {
        targets.push({ kind: 'Character', instanceId: c.instanceId, owner: oppIdx });
      }
    }

    for (const attacker of attackers) {
      for (const target of targets) {
        actions.push({ kind: 'DeclareAttack', player, attacker, target });
      }
    }
  }

  // Activate:Main
  if (leader && !p.leader.rested && leader.effects.some((e) => e.trigger === 'Activate:Main')) {
    actions.push({
      kind: 'ActivateMain',
      player,
      source: { kind: 'Leader' },
    });
  }
  for (const c of p.characters) {
    if (c.rested) continue;
    const charCard = state.catalog[c.cardId];
    if (charCard?.effects.some((e) => e.trigger === 'Activate:Main')) {
      actions.push({
        kind: 'ActivateMain',
        player,
        source: { kind: 'Character', instanceId: c.instanceId },
      });
    }
  }

  return actions;
}
