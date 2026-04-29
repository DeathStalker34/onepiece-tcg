import { describe, it, expect } from 'vitest';
import type { Action } from '@optcg/engine';
import { resolveDrop, computeValidDropIds } from './use-board-dnd';

const playCharacter: Action = {
  kind: 'PlayCharacter',
  player: 0,
  handIndex: 2,
  donSpent: 0,
};

const attachToLeader: Action = {
  kind: 'AttachDon',
  player: 0,
  target: { kind: 'Leader' },
};

const attachToChar: Action = {
  kind: 'AttachDon',
  player: 0,
  target: { kind: 'Character', instanceId: 'c1' },
};

const attackLeader: Action = {
  kind: 'DeclareAttack',
  player: 0,
  attacker: { kind: 'Leader' },
  target: { kind: 'Leader' },
};

const attackChar: Action = {
  kind: 'DeclareAttack',
  player: 0,
  attacker: { kind: 'Character', instanceId: 'a1' },
  target: { kind: 'Character', instanceId: 't1', owner: 1 },
};

describe('resolveDrop', () => {
  it('matches hand drop on field to PlayCharacter with correct handIndex', () => {
    expect(resolveDrop({ kind: 'hand', handIndex: 2 }, { kind: 'field' }, [playCharacter])).toEqual(
      playCharacter,
    );
  });

  it('returns null for hand drop with no matching action (wrong index)', () => {
    expect(
      resolveDrop({ kind: 'hand', handIndex: 9 }, { kind: 'field' }, [playCharacter]),
    ).toBeNull();
  });

  it('matches DON drop on friendly leader', () => {
    expect(
      resolveDrop({ kind: 'don', index: 0 }, { kind: 'friendly-leader' }, [attachToLeader]),
    ).toEqual(attachToLeader);
  });

  it('matches DON drop on friendly character', () => {
    expect(
      resolveDrop({ kind: 'don', index: 0 }, { kind: 'friendly-char', instanceId: 'c1' }, [
        attachToChar,
      ]),
    ).toEqual(attachToChar);
  });

  it('matches leader attacker on enemy leader', () => {
    expect(
      resolveDrop({ kind: 'attacker-leader' }, { kind: 'enemy-leader', owner: 1 }, [attackLeader]),
    ).toEqual(attackLeader);
  });

  it('matches character attacker on enemy character', () => {
    expect(
      resolveDrop(
        { kind: 'attacker-char', instanceId: 'a1' },
        { kind: 'enemy-char', instanceId: 't1', owner: 1 },
        [attackChar],
      ),
    ).toEqual(attackChar);
  });

  it('returns null when attacker drops on friendly target', () => {
    expect(
      resolveDrop({ kind: 'attacker-leader' }, { kind: 'friendly-leader' }, [attackLeader]),
    ).toBeNull();
  });

  it('returns null when DON drops on enemy target', () => {
    expect(
      resolveDrop({ kind: 'don', index: 0 }, { kind: 'enemy-leader', owner: 1 }, [attachToLeader]),
    ).toBeNull();
  });

  it('returns null when no drop intent (dropped outside)', () => {
    expect(resolveDrop({ kind: 'hand', handIndex: 2 }, null, [playCharacter])).toBeNull();
  });
});

describe('computeValidDropIds', () => {
  it('returns field for a hand drag with a play action', () => {
    expect(computeValidDropIds({ kind: 'hand', handIndex: 2 }, [playCharacter], 0)).toEqual(
      new Set(['drop:field']),
    );
  });

  it('returns friendly leader + char ids for DON drag', () => {
    expect(
      computeValidDropIds({ kind: 'don', index: 0 }, [attachToLeader, attachToChar], 0),
    ).toEqual(new Set(['drop:friendly-leader', 'drop:friendly-char:c1']));
  });

  it('returns enemy targets for an attacker drag (local player 0)', () => {
    expect(computeValidDropIds({ kind: 'attacker-leader' }, [attackLeader], 0)).toEqual(
      new Set(['drop:leader:1']),
    );
    expect(
      computeValidDropIds({ kind: 'attacker-char', instanceId: 'a1' }, [attackChar], 0),
    ).toEqual(new Set(['drop:char:t1:1']));
  });

  it('returns enemy targets for an attacker drag (local player 1)', () => {
    const attackLeaderAsP1: Action = {
      kind: 'DeclareAttack',
      player: 1,
      attacker: { kind: 'Leader' },
      target: { kind: 'Leader' },
    };
    expect(computeValidDropIds({ kind: 'attacker-leader' }, [attackLeaderAsP1], 1)).toEqual(
      new Set(['drop:leader:0']),
    );
  });

  it('returns empty set when drag has no matching legal actions', () => {
    expect(computeValidDropIds({ kind: 'hand', handIndex: 9 }, [playCharacter], 0)).toEqual(
      new Set(),
    );
  });

  it('returns empty set when intent is null', () => {
    expect(computeValidDropIds(null, [playCharacter], 0)).toEqual(new Set());
  });
});
