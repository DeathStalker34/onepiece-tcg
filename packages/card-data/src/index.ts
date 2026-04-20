import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export { ApitcgAdapter } from './adapters/apitcg';
export type { CardDataService } from './service';
export { CARD_TYPES } from './types';
export type { CardType, DomainCard, RawCard } from './types';
export type { Card } from '@prisma/client';
export type { User, Deck, DeckCard } from '@prisma/client';
