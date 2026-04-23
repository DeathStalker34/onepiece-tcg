import { z } from 'zod';

const nickname = z.string().min(1).max(24);
const matchIdSchema = z.string().regex(/^[A-Z0-9]{6}$/);
const token = z.string().min(8).max(64);

const action = z.object({ kind: z.string() }).passthrough();

export const clientMsgSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('CreateMatch'), nickname }),
  z.object({ kind: z.literal('JoinMatch'), matchId: matchIdSchema, nickname }),
  z.object({
    kind: z.literal('SubmitDeck'),
    matchId: matchIdSchema,
    token,
    leaderCardId: z.string().min(1),
    deck: z.array(z.string().min(1)).length(50),
  }),
  z.object({
    kind: z.literal('SetReady'),
    matchId: matchIdSchema,
    token,
    ready: z.boolean(),
  }),
  z.object({
    kind: z.literal('ProposeAction'),
    matchId: matchIdSchema,
    token,
    action,
  }),
  z.object({
    kind: z.literal('ProposeActionBatch'),
    matchId: matchIdSchema,
    token,
    actions: z.array(action).min(1).max(20),
  }),
  z.object({ kind: z.literal('Reconnect'), matchId: matchIdSchema, token }),
  z.object({
    kind: z.literal('Rematch'),
    matchId: matchIdSchema,
    token,
    ready: z.boolean(),
  }),
  z.object({ kind: z.literal('Forfeit'), matchId: matchIdSchema, token }),
]);

export type ValidatedClientMsg = z.infer<typeof clientMsgSchema>;
