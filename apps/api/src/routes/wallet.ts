import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

// Минимальная сумма вывода stars
export const MIN_WITHDRAWAL = 50;

// =====================================================
// GET  /api/transactions   — история движения баланса
// POST /api/withdraw       — создать заявку на вывод (decrement баланс)
// =====================================================

const WithdrawBody = z.object({
  amount: z.number().int().positive(),
});

interface SerializedTransaction {
  id: string;
  type: string;
  amount: number;
  note: string | null;
  createdAt: string;
}

export async function walletRoutes(app: FastifyInstance) {
  // ---------- GET /transactions ----------
  app.get('/transactions', { preHandler: [app.authenticate] }, async (req) => {
    const userId = (req.user as { sub: string }).sub;
    const items = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        type: true,
        amount: true,
        note: true,
        createdAt: true,
      },
    });
    return {
      items: items.map<SerializedTransaction>((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        note: t.note,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  });

  // ---------- POST /withdraw ----------
  // MVP: вывод только на собственный аккаунт (recipient = telegramId юзера),
  // реальная отправка через Bot API будет добавлена позже. Сейчас просто
  // списываем stars и пишем транзакцию.
  app.post('/withdraw', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const parsed = WithdrawBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'invalid_body', details: parsed.error.flatten() };
    }
    const { amount } = parsed.data;
    if (amount < MIN_WITHDRAWAL) {
      reply.code(400);
      return { error: 'min_amount', min: MIN_WITHDRAWAL };
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // updateMany с условием balance>=amount → атомарно списываем
        const dec = await tx.user.updateMany({
          where: { id: userId, sparkleBalance: { gte: amount } },
          data: { sparkleBalance: { decrement: amount } },
        });
        if (dec.count === 0) {
          throw new InsufficientFundsError();
        }
        const txn = await tx.transaction.create({
          data: {
            userId,
            type: 'withdrawal',
            amount: -amount,
            note: 'Withdrawal',
          },
        });
        const updatedUser = await tx.user.findUnique({
          where: { id: userId },
          select: { sparkleBalance: true },
        });
        return { txn, balance: updatedUser?.sparkleBalance ?? 0 };
      });

      return {
        ok: true,
        starBalance: result.balance,
        transaction: {
          id: result.txn.id,
          type: result.txn.type,
          amount: result.txn.amount,
          note: result.txn.note,
          createdAt: result.txn.createdAt.toISOString(),
        },
      };
    } catch (err) {
      if (err instanceof InsufficientFundsError) {
        reply.code(402);
        return { ok: false, error: 'insufficient_funds' };
      }
      throw err;
    }
  });
}

class InsufficientFundsError extends Error {
  constructor() {
    super('insufficient funds');
    this.name = 'InsufficientFundsError';
  }
}
