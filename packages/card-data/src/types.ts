import { z } from 'zod';

export const CARD_TYPES = ['LEADER', 'CHARACTER', 'EVENT', 'STAGE', 'DON'] as const;
export type CardType = (typeof CARD_TYPES)[number];

export const RawCardSchema = z.object({
  id: z.string().min(1),
  code: z.string().optional(),
  name: z.string().min(1),
  rarity: z.string().min(1),
  type: z.enum(CARD_TYPES),
  cost: z.number().int().nullable().optional(),
  power: z.number().int().nullable().optional(),
  counter: z.union([z.number(), z.string()]).nullable().optional(),
  life: z.number().int().nullable().optional(),
  color: z.string().min(1),
  family: z.string().optional(),
  ability: z.string().optional(),
  trigger: z.string().optional(),
  attribute: z.object({ name: z.string().optional(), image: z.string().optional() }).optional(),
  set: z.object({
    id: z.string().optional(),
    name: z.string().min(1),
  }),
  images: z.object({
    small: z.string().url().optional(),
    large: z.string().url(),
  }),
});

export type RawCard = z.infer<typeof RawCardSchema>;

export interface DomainCard {
  id: string;
  setId: string;
  setName: string;
  name: string;
  rarity: string;
  type: CardType;
  cost: number | null;
  power: number | null;
  counter: number | null;
  life: number | null;
  colors: string[];
  attributes: string[];
  effectText: string;
  triggerText: string | null;
  sourceImageUrl: string;
}
