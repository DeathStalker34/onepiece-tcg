import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
export type { Card } from '@prisma/client';
