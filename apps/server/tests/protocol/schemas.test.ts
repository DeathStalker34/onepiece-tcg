import { describe, it, expect } from 'vitest';
import { clientMsgSchema } from '../../src/protocol/schemas';

describe('clientMsgSchema', () => {
  it('accepts CreateMatch', () => {
    const msg = { kind: 'CreateMatch', nickname: 'Tiago' };
    expect(clientMsgSchema.safeParse(msg).success).toBe(true);
  });

  it('rejects CreateMatch with empty nickname', () => {
    const msg = { kind: 'CreateMatch', nickname: '' };
    expect(clientMsgSchema.safeParse(msg).success).toBe(false);
  });

  it('accepts ProposeAction with EndTurn', () => {
    const msg = {
      kind: 'ProposeAction',
      matchId: 'ABC123',
      token: 'abcdefgh',
      action: { kind: 'EndTurn', player: 0 },
    };
    expect(clientMsgSchema.safeParse(msg).success).toBe(true);
  });

  it('rejects unknown kind', () => {
    const msg = { kind: 'Nope' };
    expect(clientMsgSchema.safeParse(msg).success).toBe(false);
  });

  it('accepts ProposeActionBatch with array of actions', () => {
    const msg = {
      kind: 'ProposeActionBatch',
      matchId: 'ABC123',
      token: 'abcdefgh',
      actions: [
        { kind: 'PlayCounter', player: 0, handIndex: 0 },
        { kind: 'DeclineCounter', player: 0 },
      ],
    };
    expect(clientMsgSchema.safeParse(msg).success).toBe(true);
  });
});
