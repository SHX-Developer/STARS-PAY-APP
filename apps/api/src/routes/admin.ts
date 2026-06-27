import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { request } from 'undici';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';

const COMPLETED_ORDER_STATUSES = ['delivered', 'completed'] as const;
const ACTIVE_ORDER_STATUSES = ['created', 'paid', 'delivering'] as const;

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', requireAdmin);

  app.get('/admin/stats', async () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalUsers,
      usersToday,
      totalOrders,
      activeOrders,
      completedOrders,
      cancelledOrders,
      ordersToday,
      revenue,
      revenueToday,
      starsSold,
      premiumOrders,
      balance,
      pendingWithdrawals,
      completedWithdrawals,
      pendingWithdrawalSum,
      completedWithdrawalSum,
      taskCompletions,
      recentOrders,
      recentWithdrawals,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.order.count(),
      prisma.order.count({ where: { status: { in: [...ACTIVE_ORDER_STATUSES] } } }),
      prisma.order.count({ where: { status: { in: [...COMPLETED_ORDER_STATUSES] } } }),
      prisma.order.count({ where: { status: 'cancelled' } }),
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.order.aggregate({
        where: { status: { in: [...COMPLETED_ORDER_STATUSES, 'paid', 'delivering'] } },
        _sum: { priceUsd: true },
      }),
      prisma.order.aggregate({
        where: {
          createdAt: { gte: today },
          status: { in: [...COMPLETED_ORDER_STATUSES, 'paid', 'delivering'] },
        },
        _sum: { priceUsd: true },
      }),
      prisma.order.aggregate({
        where: { kind: 'stars', status: { in: [...COMPLETED_ORDER_STATUSES, 'paid', 'delivering'] } },
        _sum: { amount: true },
      }),
      prisma.order.count({
        where: { kind: 'premium', status: { in: [...COMPLETED_ORDER_STATUSES, 'paid', 'delivering'] } },
      }),
      prisma.user.aggregate({ _sum: { sparkleBalance: true } }),
      prisma.withdrawal.count({ where: { status: 'pending' } }),
      prisma.withdrawal.count({ where: { status: 'completed' } }),
      prisma.withdrawal.aggregate({ where: { status: 'pending' }, _sum: { amount: true } }),
      prisma.withdrawal.aggregate({ where: { status: 'completed' }, _sum: { amount: true } }),
      prisma.taskCompletion.count(),
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { user: { select: { firstName: true, username: true, telegramId: true } } },
      }),
      prisma.withdrawal.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { firstName: true, username: true, telegramId: true } } },
      }),
    ]);

    return {
      stats: {
        users: { total: totalUsers, today: usersToday },
        orders: {
          total: totalOrders,
          today: ordersToday,
          active: activeOrders,
          completed: completedOrders,
          cancelled: cancelledOrders,
        },
        revenue: {
          totalUzs: Number(revenue._sum.priceUsd ?? 0),
          todayUzs: Number(revenueToday._sum.priceUsd ?? 0),
        },
        products: {
          starsSold: starsSold._sum.amount ?? 0,
          premiumOrders,
        },
        wallet: {
          userBalanceStars: balance._sum.sparkleBalance ?? 0,
          pendingWithdrawals,
          completedWithdrawals,
          pendingWithdrawalStars: pendingWithdrawalSum._sum.amount ?? 0,
          completedWithdrawalStars: completedWithdrawalSum._sum.amount ?? 0,
        },
        tasks: { completions: taskCompletions },
      },
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        number: o.number,
        kind: o.kind,
        recipientUsername: o.recipientUsername,
        amount: o.amount,
        priceUzs: Number(o.priceUsd),
        status: o.status,
        createdAt: o.createdAt.toISOString(),
        user: serializeAdminUser(o.user),
      })),
      withdrawals: recentWithdrawals.map((w) => serializeWithdrawal(w)),
      delivery: {
        withdrawalApiConfigured: Boolean(config.WITHDRAWAL_DELIVERY_API_URL),
        orderApiConfigured: Boolean(config.ORDER_DELIVERY_API_URL),
      },
    };
  });

  app.post('/admin/withdrawals/:id/complete', async (req, reply) => {
    const { id } = req.params as { id: string };
    const adminTgId = BigInt((req.user as { tgId: string }).tgId);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const withdrawal = await tx.withdrawal.findUnique({
          where: { id },
          include: { user: { select: { firstName: true, username: true, telegramId: true } } },
        });
        if (!withdrawal) throw new AdminActionError(404, 'withdrawal_not_found');
        if (withdrawal.status !== 'pending') {
          throw new AdminActionError(409, 'withdrawal_not_pending');
        }

        await deliverWithdrawal(withdrawal);

        const updated = await tx.withdrawal.update({
          where: { id },
          data: {
            status: 'completed',
            processedByTgId: adminTgId,
            completedAt: new Date(),
          },
          include: { user: { select: { firstName: true, username: true, telegramId: true } } },
        });
        return updated;
      });
      return { ok: true, withdrawal: serializeWithdrawal(result) };
    } catch (err) {
      return handleAdminActionError(err, reply);
    }
  });

  app.post('/admin/withdrawals/:id/cancel', async (req, reply) => {
    const { id } = req.params as { id: string };
    const adminTgId = BigInt((req.user as { tgId: string }).tgId);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const withdrawal = await tx.withdrawal.findUnique({
          where: { id },
          include: { user: { select: { firstName: true, username: true, telegramId: true } } },
        });
        if (!withdrawal) throw new AdminActionError(404, 'withdrawal_not_found');
        if (withdrawal.status !== 'pending') {
          throw new AdminActionError(409, 'withdrawal_not_pending');
        }

        await tx.user.update({
          where: { id: withdrawal.userId },
          data: { sparkleBalance: { increment: withdrawal.amount } },
        });
        await tx.transaction.create({
          data: {
            userId: withdrawal.userId,
            type: 'admin',
            amount: withdrawal.amount,
            note: `Withdrawal #${withdrawal.number} cancelled refund`,
            refId: withdrawal.id,
          },
        });
        const updated = await tx.withdrawal.update({
          where: { id },
          data: {
            status: 'cancelled',
            processedByTgId: adminTgId,
            cancelledAt: new Date(),
          },
          include: { user: { select: { firstName: true, username: true, telegramId: true } } },
        });
        return updated;
      });
      return { ok: true, withdrawal: serializeWithdrawal(result) };
    } catch (err) {
      return handleAdminActionError(err, reply);
    }
  });
}

async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const tgId = (req.user as { tgId?: string } | undefined)?.tgId;
  const admins = adminTelegramIds();
  if (!tgId || !admins.has(tgId)) {
    return reply.code(403).send({ error: 'forbidden' });
  }
}

function adminTelegramIds(): Set<string> {
  return new Set(
    config.ADMIN_TELEGRAM_IDS.split(',')
      .map((v) => v.trim())
      .filter(Boolean),
  );
}

async function deliverWithdrawal(w: {
  id: string;
  number: number;
  amount: number;
  recipientUsername: string | null;
  recipientTelegramId: bigint;
}) {
  if (!config.WITHDRAWAL_DELIVERY_API_URL) return;

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (config.WITHDRAWAL_DELIVERY_API_KEY) {
    headers.authorization = `Bearer ${config.WITHDRAWAL_DELIVERY_API_KEY}`;
  }

  const res = await request(config.WITHDRAWAL_DELIVERY_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      withdrawalId: w.id,
      withdrawalNumber: w.number,
      amount: w.amount,
      recipientUsername: w.recipientUsername,
      recipientTelegramId: w.recipientTelegramId.toString(),
    }),
    headersTimeout: config.WITHDRAWAL_DELIVERY_API_TIMEOUT_MS,
    bodyTimeout: config.WITHDRAWAL_DELIVERY_API_TIMEOUT_MS,
  });

  const text = await res.body.text();
  let json: { ok?: boolean; error?: string; message?: string } | null = null;
  try {
    json = text ? JSON.parse(text) as { ok?: boolean; error?: string; message?: string } : null;
  } catch {
    json = null;
  }
  if (res.statusCode < 200 || res.statusCode >= 300 || json?.ok === false) {
    throw new AdminActionError(
      502,
      json?.error ?? json?.message ?? `withdrawal_delivery_failed_${res.statusCode}`,
    );
  }
}

function serializeAdminUser(u: {
  firstName: string;
  username: string | null;
  telegramId: bigint;
}) {
  return {
    firstName: u.firstName,
    username: u.username,
    telegramId: u.telegramId.toString(),
  };
}

function serializeWithdrawal(w: {
  id: string;
  number: number;
  amount: number;
  recipientUsername: string | null;
  recipientTelegramId: bigint;
  status: string;
  note: string | null;
  createdAt: Date;
  completedAt: Date | null;
  cancelledAt: Date | null;
  user: { firstName: string; username: string | null; telegramId: bigint };
}) {
  return {
    id: w.id,
    number: w.number,
    amount: w.amount,
    recipientUsername: w.recipientUsername,
    recipientTelegramId: w.recipientTelegramId.toString(),
    status: w.status,
    note: w.note,
    createdAt: w.createdAt.toISOString(),
    completedAt: w.completedAt?.toISOString() ?? null,
    cancelledAt: w.cancelledAt?.toISOString() ?? null,
    user: serializeAdminUser(w.user),
  };
}

class AdminActionError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AdminActionError';
  }
}

function handleAdminActionError(err: unknown, reply: FastifyReply) {
  if (err instanceof AdminActionError) {
    reply.code(err.statusCode);
    return { ok: false, error: err.message };
  }
  throw err;
}
