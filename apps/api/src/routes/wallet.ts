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

function serializeTransaction(t: {
  id: string;
  type: string;
  amount: number;
  note: string | null;
  createdAt: Date;
}): SerializedTransaction {
  return {
    id: t.id,
    type: t.type,
    amount: t.amount,
    note: t.note,
    createdAt: t.createdAt.toISOString(),
  };
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
    return { items: items.map<SerializedTransaction>(serializeTransaction) };
  });

  // ---------- POST /withdraw ----------
  // Вывод только на собственный аккаунт. Баланс резервируется атомарно,
  // создаётся pending-заявка; админ завершает или отменяет её в панели.
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
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true, sparkleBalance: true, username: true, telegramId: true },
        });
        if (!user) throw new Error('user_not_found');
        if (!user.username) throw new MissingUsernameError();

        // updateMany с условием balance>=amount → атомарно резервируем
        const dec = await tx.user.updateMany({
          where: { id: userId, sparkleBalance: { gte: amount } },
          data: { sparkleBalance: { decrement: amount } },
        });
        if (dec.count === 0) {
          throw new InsufficientFundsError();
        }
        const withdrawal = await tx.withdrawal.create({
          data: {
            userId,
            amount,
            recipientUsername: user.username,
            recipientTelegramId: user.telegramId,
            status: 'pending',
          },
        });
        const txn = await tx.transaction.create({
          data: {
            userId,
            type: 'withdrawal',
            amount: -amount,
            note: `Withdrawal request #${withdrawal.number} to @${user.username}`,
            refId: withdrawal.id,
          },
        });
        return { txn, withdrawal, balance: user.sparkleBalance - amount };
      });

      return {
        ok: true,
        starBalance: result.balance,
        transaction: serializeTransaction(result.txn),
        withdrawal: {
          id: result.withdrawal.id,
          number: result.withdrawal.number,
          status: result.withdrawal.status,
          amount: result.withdrawal.amount,
          recipientUsername: result.withdrawal.recipientUsername,
          createdAt: result.withdrawal.createdAt.toISOString(),
        },
      };
    } catch (err) {
      if (err instanceof InsufficientFundsError) {
        reply.code(402);
        return { ok: false, error: 'insufficient_funds' };
      }
      if (err instanceof MissingUsernameError) {
        reply.code(400);
        return { ok: false, error: 'username_required' };
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

class MissingUsernameError extends Error {
  constructor() {
    super('telegram username is required for withdrawal');
    this.name = 'MissingUsernameError';
  }
}
