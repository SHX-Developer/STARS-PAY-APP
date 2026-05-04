import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { maybeCreditReferralBonus } from '../lib/referral-bonus.js';

// =====================================================
// POST /api/orders   — создать заказ
// GET  /api/orders   — мои заказы
// =====================================================

const CreateOrderBody = z.object({
  kind: z.enum(['stars', 'premium']),
  recipientUsername: z
    .string()
    .min(1)
    .max(64)
    .transform((s) => s.replace(/^@/, '').trim()),
  amount: z.number().int().positive(),
  priceUsd: z.number().nonnegative(),
});

// Premium доступен только в трёх вариантах. Stars — любое целое > 0.
const PREMIUM_MONTHS = [3, 6, 12];

export async function ordersRoutes(app: FastifyInstance) {
  // ---------- POST /orders ----------
  // MVP: order создаётся со статусом 'paid' сразу (нет реальной интеграции
  // с платёжкой). После создания триггерим реф-бонус — пригласителю +10★.
  app.post('/orders', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const parsed = CreateOrderBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'invalid_body', details: parsed.error.flatten() };
    }
    const { kind, recipientUsername, amount, priceUsd } = parsed.data;

    if (kind === 'premium' && !PREMIUM_MONTHS.includes(amount)) {
      reply.code(400);
      return { error: 'invalid_amount', allowed: PREMIUM_MONTHS };
    }

    const order = await prisma.order.create({
      data: {
        userId,
        kind,
        recipientUsername,
        amount,
        priceUsd,
        status: 'paid', // MVP: считаем оплаченным сразу
      },
    });

    // Реф-бонус: пригласителю +10★ за первый paid-заказ этого юзера
    const bonus = await maybeCreditReferralBonus(userId);

    return {
      order: serializeOrder(order),
      referralBonus: bonus.credited
        ? { creditedTo: bonus.inviterId, amount: bonus.amount }
        : null,
    };
  });

  // ---------- GET /orders ----------
  app.get('/orders', { preHandler: [app.authenticate] }, async (req) => {
    const userId = (req.user as { sub: string }).sub;
    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { items: orders.map(serializeOrder) };
  });
}

function serializeOrder(o: {
  id: string;
  kind: string;
  recipientUsername: string;
  amount: number;
  priceUsd: { toString(): string };
  status: string;
  createdAt: Date;
}) {
  return {
    id: o.id,
    kind: o.kind,
    recipientUsername: o.recipientUsername,
    amount: o.amount,
    priceUsd: o.priceUsd.toString(),
    status: o.status,
    createdAt: o.createdAt.toISOString(),
  };
}
