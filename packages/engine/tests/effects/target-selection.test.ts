import { describe, it, expect } from 'vitest';
import { applyEffect } from '../../src/effects/executor';
import type { GameState, PlayerState, CharacterInPlay } from '../../src/types/state';
import type { CardStatic, Effect } from '../../src/types/card';

const C: CardStatic = {
  id: 'C',
  type: 'CHARACTER',
  colors: ['Red'],
  cost: 3,
  power: 4000,
  life: null,
  counter: 1000,
  keywords: [],
  effects: [],
  manualText: null,
};

function makeChar(id: string): CharacterInPlay {
  return {
    instanceId: id,
    cardId: 'C',
    rested: false,
    attachedDon: 0,
    powerThisTurn: 0,
    summoningSickness: false,
    usedBlockerThisTurn: false,
  };
}

function makePlayer(chars: CharacterInPlay[]): PlayerState {
  return {
    playerId: 'p',
    leader: { cardId: 'C', rested: false, attachedDon: 0, powerThisTurn: 0 },
    deck: [],
    hand: [],
    life: [],
    trash: [],
    banishZone: [],
    characters: chars,
    stage: null,
    donActive: 0,
    donRested: 0,
    donDeck: 10,
    mulliganTaken: false,
    firstTurnUsed: false,
  };
}

function makeState(p1Chars: CharacterInPlay[]): GameState {
  return {
    turn: 1,
    activePlayer: 0,
    phase: 'Main',
    priorityWindow: null,
    players: [makePlayer([]), makePlayer(p1Chars)],
    rng: { seed: 1, pointer: 0 },
    log: [],
    winner: null,
    catalog: { C },
    isFirstTurnOfFirstPlayer: false,
  };
}

describe('applyEffect target selection', () => {
  it('opens EffectTargetSelection when 2+ valid targets', () => {
    const state = makeState([makeChar('a'), makeChar('b')]);
    const effect: Effect = { kind: 'ko', target: { kind: 'opponentCharacter' } };
    const r = applyEffect(state, effect, { sourcePlayer: 0, sourceCardId: 'src' });
    expect(r.state.priorityWindow?.kind).toBe('EffectTargetSelection');
    if (r.state.priorityWindow?.kind === 'EffectTargetSelection') {
      expect(r.state.priorityWindow.validTargets).toHaveLength(2);
      expect(r.state.priorityWindow.optional).toBe(false);
      expect(r.state.priorityWindow.pendingChain).toEqual([]);
      expect(r.state.priorityWindow.sourceCardId).toBe('src');
      expect(r.state.priorityWindow.sourceOwner).toBe(0);
    }
    // No EffectResolved emitted yet — pending
    expect(r.events).toEqual([]);
  });

  it('resolves directly when single mandatory target', () => {
    const state = makeState([makeChar('a')]);
    const effect: Effect = { kind: 'ko', target: { kind: 'opponentCharacter' } };
    const r = applyEffect(state, effect, { sourcePlayer: 0, sourceCardId: 'src' });
    expect(r.state.priorityWindow).toBeNull();
    expect(r.state.players[1].characters).toHaveLength(0);
    expect(r.state.players[1].trash).toEqual(['C']);
  });

  it('opens window with optional flag when single target + optional', () => {
    const state = makeState([makeChar('a')]);
    const effect: Effect = {
      kind: 'ko',
      target: { kind: 'opponentCharacter' },
      optional: true,
    };
    const r = applyEffect(state, effect, { sourcePlayer: 0, sourceCardId: 'src' });
    expect(r.state.priorityWindow?.kind).toBe('EffectTargetSelection');
    if (r.state.priorityWindow?.kind === 'EffectTargetSelection') {
      expect(r.state.priorityWindow.optional).toBe(true);
    }
  });

  it('fizzles when 0 candidates (mandatory)', () => {
    const state = makeState([]);
    const effect: Effect = { kind: 'ko', target: { kind: 'opponentCharacter' } };
    const r = applyEffect(state, effect, { sourcePlayer: 0, sourceCardId: 'src' });
    expect(r.state.priorityWindow).toBeNull();
    expect(r.state.players[1].characters).toHaveLength(0);
  });

  it('fizzles when 0 candidates (optional)', () => {
    const state = makeState([]);
    const effect: Effect = {
      kind: 'ko',
      target: { kind: 'opponentCharacter' },
      optional: true,
    };
    const r = applyEffect(state, effect, { sourcePlayer: 0, sourceCardId: 'src' });
    expect(r.state.priorityWindow).toBeNull();
  });

  it('opens window for power effect with multiple targets', () => {
    const state = makeState([makeChar('a'), makeChar('b')]);
    const effect: Effect = {
      kind: 'power',
      target: { kind: 'opponentCharacter' },
      delta: -2000,
      duration: 'thisTurn',
    };
    const r = applyEffect(state, effect, { sourcePlayer: 0, sourceCardId: 'src' });
    expect(r.state.priorityWindow?.kind).toBe('EffectTargetSelection');
  });
});

import { triggerHook } from '../../src/effects/triggers';

describe('triggerHook pendingChain', () => {
  it('queues remaining effects when first effect opens a window', () => {
    const SOURCE: CardStatic = {
      id: 'S',
      type: 'CHARACTER',
      colors: ['Red'],
      cost: 3,
      power: 4000,
      life: null,
      counter: 1000,
      keywords: [],
      effects: [
        {
          trigger: 'OnPlay',
          effect: { kind: 'ko', target: { kind: 'opponentCharacter' } }, // multi-target
        },
        {
          trigger: 'OnPlay',
          effect: { kind: 'draw', amount: 1 },
        },
      ],
      manualText: null,
    };
    const baseState = makeState([makeChar('a'), makeChar('b')]);
    const stateWithSource: GameState = {
      ...baseState,
      catalog: { ...baseState.catalog, S: SOURCE },
    };
    const r = triggerHook(stateWithSource, 'OnPlay', 'S', 0);
    expect(r.state.priorityWindow?.kind).toBe('EffectTargetSelection');
    if (r.state.priorityWindow?.kind === 'EffectTargetSelection') {
      expect(r.state.priorityWindow.pendingChain).toHaveLength(1);
      expect(r.state.priorityWindow.pendingChain[0].kind).toBe('draw');
    }
  });

  it('applies all effects when none block', () => {
    const SOURCE: CardStatic = {
      id: 'S2',
      type: 'CHARACTER',
      colors: ['Red'],
      cost: 3,
      power: 4000,
      life: null,
      counter: 1000,
      keywords: [],
      effects: [
        { trigger: 'OnPlay', effect: { kind: 'draw', amount: 1 } },
        { trigger: 'OnPlay', effect: { kind: 'draw', amount: 1 } },
      ],
      manualText: null,
    };
    const baseState = makeState([]);
    const stateWithSource: GameState = {
      ...baseState,
      catalog: { ...baseState.catalog, S2: SOURCE },
      players: [
        { ...baseState.players[0], deck: ['C', 'C', 'C'] },
        baseState.players[1],
      ] as GameState['players'],
    };
    const r = triggerHook(stateWithSource, 'OnPlay', 'S2', 0);
    expect(r.state.priorityWindow).toBeNull();
    expect(r.state.players[0].hand).toHaveLength(2);
  });
});
