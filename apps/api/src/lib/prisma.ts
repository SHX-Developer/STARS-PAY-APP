import { PrismaClient } from '@prisma/client';
import { isDev } from '../config.js';

// Singleton Prisma client
export const prisma = new PrismaClient({
  log: isDev ? ['query', 'warn', 'error'] : ['warn', 'error'],
});

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
