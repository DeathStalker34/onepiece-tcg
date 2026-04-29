import { describe, it, expect } from 'vitest';
import type { Action, GameState } from '@optcg/engine';
import { buildAction, resolveDrop, computeValidDropIds } from './use-board-dnd';

// Minimal GameState stub — only fields actually read by buildAction / computeValidDropIds.
function stubState(overrides: {
  hand?: Record<number, string>;
  catalog?: Record<string, { type: 'CHARACTER' | 'EVENT' | 'STAGE' }>;
  myCharacters?: Array<{ instanceId: string }>;
  oppCharacters?: Array<{ instanceId: string }>;
  localPlayer?: 0 | 1;
}): GameState {
  const handArr: string[] = [];
  if (overrides.hand) {
    for (const [k, v] of Object.entries(overrides.hand)) handArr[Number(k)] = v;
  }
  const me = {
    hand: handArr,
    characters: overrides.myCharacters ?? [],
  };
  const opp = {
    hand: [],
    characters: overrides.oppCharacters ?? [],
  };
  const players = overrides.localPlayer === 1 ? [opp, me] : [me, opp];
  return {
    players,
    catalog: overrides.catalog ?? {},
  } as unknown as GameState;
}

const allLegal = () => true;
const noneLegal = () => false;

describe('buildAction', () => {
  it('hand→field with CHARACTER → PlayCharacter', () => {
    const state = stubState({
      hand: { 2: 'OP01-001' },
      catalog: { 'OP01-001': { type: 'CHARACTER' } },
    });
    expect(buildAction({ kind: 'hand', handIndex: 2 }, { kind: 'field' }, state, 0)).toEqual({
      kind: 'PlayCharacter',
      player: 0,
      handIndex: 2,
      donSpent: 0,
    });
  });

  it('hand→field with EVENT → PlayEvent', () => {
    const state = stubState({
      hand: { 0: 'OP01-EV' },
      catalog: { 'OP01-EV': { type: 'EVENT' } },
    });
    expect(buildAction({ kind: 'hand', handIndex: 0 }, { kind: 'field' }, state, 0)).toEqual({
      kind: 'PlayEvent',
      player: 0,
      handIndex: 0,
      donSpent: 0,
    });
  });

  it('hand→field with empty slot → null', () => {
    const state = stubState({ hand: {}, catalog: {} });
    expect(buildAction({ kind: 'hand', handIndex: 0 }, { kind: 'field' }, state, 0)).toBeNull();
  });

  it('don→friendly-leader → AttachDon to Leader', () => {
    const state = stubState({});
    expect(buildAction({ kind: 'don', index: 0 }, { kind: 'friendly-leader' }, state, 0)).toEqual({
      kind: 'AttachDon',
      player: 0,
      target: { kind: 'Leader' },
    });
  });

  it('don→friendly-char → AttachDon to Character', () => {
    const state = stubState({});
    expect(
      buildAction({ kind: 'don', index: 0 }, { kind: 'friendly-char', instanceId: 'c1' }, state, 0),
    ).toEqual({
      kind: 'AttachDon',
      player: 0,
      target: { kind: 'Character', instanceId: 'c1' },
    });
  });

  it('attacker-leader→enemy-leader → DeclareAttack leader on leader', () => {
    const state = stubState({});
    expect(
      buildAction({ kind: 'attacker-leader' }, { kind: 'enemy-leader', owner: 1 }, state, 0),
    ).toEqual({
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Leader' },
      target: { kind: 'Leader' },
    });
  });

  it('attacker-char→enemy-char → DeclareAttack', () => {
    const state = stubState({});
    expect(
      buildAction(
        { kind: 'attacker-char', instanceId: 'a1' },
        { kind: 'enemy-char', instanceId: 't1', owner: 1 },
        state,
        0,
      ),
    ).toEqual({
      kind: 'DeclareAttack',
      player: 0,
      attacker: { kind: 'Character', instanceId: 'a1' },
      target: { kind: 'Character', instanceId: 't1', owner: 1 },
    });
  });

  it('mismatched intent pair (don → field) → null', () => {
    const state = stubState({});
    expect(buildAction({ kind: 'don', index: 0 }, { kind: 'field' }, state, 0)).toBeNull();
  });
});

describe('resolveDrop', () => {
  const state = stubState({
    hand: { 2: 'OP01-001' },
    catalog: { 'OP01-001': { type: 'CHARACTER' } },
  });

  it('returns the action when isLegal accepts', () => {
    const result = resolveDrop(
      { kind: 'hand', handIndex: 2 },
      { kind: 'field' },
      state,
      0,
      allLegal,
    );
    expect(result?.kind).toBe('PlayCharacter');
  });

  it('returns null when isLegal rejects', () => {
    expect(
      resolveDrop({ kind: 'hand', handIndex: 2 }, { kind: 'field' }, state, 0, noneLegal),
    ).toBeNull();
  });

  it('returns null when drop is null (dropped outside)', () => {
    expect(resolveDrop({ kind: 'hand', handIndex: 2 }, null, state, 0, allLegal)).toBeNull();
  });

  it('returns null when buildAction yields null', () => {
    const empty = stubState({});
    expect(
      resolveDrop({ kind: 'hand', handIndex: 0 }, { kind: 'field' }, empty, 0, allLegal),
    ).toBeNull();
  });
});

describe('computeValidDropIds', () => {
  it('hand drag → drop:field if legal', () => {
    const state = stubState({
      hand: { 0: 'OP01-001' },
      catalog: { 'OP01-001': { type: 'CHARACTER' } },
    });
    expect(computeValidDropIds({ kind: 'hand', handIndex: 0 }, state, 0, allLegal)).toEqual(
      new Set(['drop:field']),
    );
  });

  it('hand drag → empty when illegal', () => {
    const state = stubState({
      hand: { 0: 'OP01-001' },
      catalog: { 'OP01-001': { type: 'CHARACTER' } },
    });
    expect(computeValidDropIds({ kind: 'hand', handIndex: 0 }, state, 0, noneLegal)).toEqual(
      new Set(),
    );
  });

  it('don drag enumerates own leader + own characters', () => {
    const state = stubState({
      myCharacters: [{ instanceId: 'c1' }, { instanceId: 'c2' }],
    });
    expect(computeValidDropIds({ kind: 'don', index: 0 }, state, 0, allLegal)).toEqual(
      new Set(['drop:friendly-leader', 'drop:friendly-char:c1', 'drop:friendly-char:c2']),
    );
  });

  it('attacker drag enumerates enemy leader + enemy characters', () => {
    const state = stubState({
      oppCharacters: [{ instanceId: 't1' }],
    });
    expect(computeValidDropIds({ kind: 'attacker-leader' }, state, 0, allLegal)).toEqual(
      new Set(['drop:leader:1', 'drop:char:t1:1']),
    );
  });

  it('attacker drag with localPlayer 1 uses player 0 as opponent', () => {
    const state = stubState({
      localPlayer: 1,
      oppCharacters: [{ instanceId: 't1' }],
    });
    expect(computeValidDropIds({ kind: 'attacker-leader' }, state, 1, allLegal)).toEqual(
      new Set(['drop:leader:0', 'drop:char:t1:0']),
    );
  });

  it('null drag → empty', () => {
    const state = stubState({});
    expect(computeValidDropIds(null, state, 0, allLegal)).toEqual(new Set());
  });

  it('respects isLegal filter — only legal drops included', () => {
    const state = stubState({
      myCharacters: [{ instanceId: 'c1' }, { instanceId: 'c2' }],
    });
    const onlyLeaderLegal = (action: Action) =>
      action.kind === 'AttachDon' && action.target.kind === 'Leader';
    expect(computeValidDropIds({ kind: 'don', index: 0 }, state, 0, onlyLeaderLegal)).toEqual(
      new Set(['drop:friendly-leader']),
    );
  });
});
