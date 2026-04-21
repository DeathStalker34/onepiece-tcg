import type { GameState, PlayerIndex, AttackerRef, DefenderRef } from '../types/state';
import type { GameEvent } from '../types/event';
import type { CardStatic, Effect } from '../types/card';

export interface ResolveResult {
  state: GameState;
  events: GameEvent[];
}

function findTriggerEffect(card: CardStatic): Effect | null {
  const t = card.effects.find((e) => e.trigger === 'Trigger');
  return t ? t.effect : null;
}

function getAttackerCardId(state: GameState, attacker: AttackerRef): string {
  if (attacker.source.kind === 'Leader') {
    return state.players[attacker.owner].leader.cardId;
  }
  const instanceId = attacker.source.instanceId;
  const char = state.players[attacker.owner].characters.find((c) => c.instanceId === instanceId);
  return char?.cardId ?? '';
}

export function resolveCombat(
  state: GameState,
  attacker: AttackerRef,
  defender: DefenderRef,
): ResolveResult {
  // If attacker power < defender power → no damage, close window
  if (attacker.attackPower < defender.defensePower) {
    return {
      state: { ...state, priorityWindow: null },
      events: [],
    };
  }

  // Damage inflicted
  const defenderOwner = defender.owner;
  const dp = state.players[defenderOwner];
  const events: GameEvent[] = [];

  if (defender.target.kind === 'Leader') {
    // Life loss
    const attackerCardId = getAttackerCardId(state, attacker);
    const attackerCard = state.catalog[attackerCardId];
    const isDouble = !!attackerCard?.keywords.includes('DoubleAttack');
    const lifeLoss = isDouble ? 2 : 1;

    let life = dp.life;
    let hand = dp.hand;

    for (let i = 0; i < lifeLoss; i += 1) {
      if (life.length === 0) {
        // Leader received damage with no life → lose
        const winner: PlayerIndex = attacker.owner;
        const updated = { ...dp, life, hand };
        const newPlayers = state.players.map((pp, ix) =>
          ix === defenderOwner ? updated : pp,
        ) as GameState['players'];
        events.push({ kind: 'GameOver', winner });
        return {
          state: {
            ...state,
            players: newPlayers,
            priorityWindow: null,
            phase: 'GameOver',
            winner,
          },
          events,
        };
      }
      const [top, ...rest] = life;
      life = rest;
      const topCard = state.catalog[top];
      const triggerEffect = topCard ? findTriggerEffect(topCard) : null;

      events.push({
        kind: 'LifeLost',
        player: defenderOwner,
        remaining: life.length,
        revealedCardId: top,
      });

      if (triggerEffect) {
        // Open TriggerStep — do NOT auto-move to hand yet
        const triggerStep: GameState['priorityWindow'] = {
          kind: 'TriggerStep',
          revealedCardId: top,
          owner: defenderOwner,
          triggerEffect,
        };
        const updated = { ...dp, life, hand };
        const newPlayers = state.players.map((pp, ix) =>
          ix === defenderOwner ? updated : pp,
        ) as GameState['players'];
        return {
          state: { ...state, players: newPlayers, priorityWindow: triggerStep },
          events,
        };
      }
      // No trigger: card goes to hand immediately
      hand = [...hand, top];
    }

    const updated = { ...dp, life, hand };
    const newPlayers = state.players.map((pp, ix) =>
      ix === defenderOwner ? updated : pp,
    ) as GameState['players'];
    return {
      state: { ...state, players: newPlayers, priorityWindow: null },
      events,
    };
  }

  // Character KO
  const targetInstanceId = defender.target.instanceId;
  const idx = dp.characters.findIndex((c) => c.instanceId === targetInstanceId);
  if (idx === -1) {
    return { state: { ...state, priorityWindow: null }, events };
  }
  const victim = dp.characters[idx];
  const victimCard = state.catalog[victim.cardId];
  const banish = !!victimCard?.keywords.includes('Banish');

  const newChars = [...dp.characters.slice(0, idx), ...dp.characters.slice(idx + 1)];
  const newTrash = banish ? dp.trash : [...dp.trash, victim.cardId];
  const newBanish = banish ? [...dp.banishZone, victim.cardId] : dp.banishZone;

  const updated = {
    ...dp,
    characters: newChars,
    trash: newTrash,
    banishZone: newBanish,
  };
  const newPlayers = state.players.map((pp, ix) =>
    ix === defenderOwner ? updated : pp,
  ) as GameState['players'];

  events.push({
    kind: 'CharacterKod',
    instanceId: victim.instanceId,
    cardId: victim.cardId,
  });

  return {
    state: { ...state, players: newPlayers, priorityWindow: null },
    events,
  };
}
