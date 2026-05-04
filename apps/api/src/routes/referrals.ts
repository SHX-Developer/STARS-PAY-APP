import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { REFERRAL_FIRST_ORDER_BONUS } from '../lib/referral-bonus.js';

// =====================================================
// GET /api/referrals
// Возвращает реф-код, реф-ссылку, статистику и список приглашённых.
// =====================================================
export async function referralRoutes(app: FastifyInstance) {
  app.get('/referrals', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;

    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, referralCode: true },
    });
    if (!me) {
      reply.code(404);
      return { error: 'user_not_found' };
    }

    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);

    const [referrals, totalCount, monthCount, paidBonusCount] = await Promise.all([
      prisma.user.findMany({
        where: { referredById: me.id },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          avatarLocalPath: true,
          photoUrl: true,
          createdAt: true,
          referrerBonusGiven: true,
          _count: { select: { orders: true } },
        },
      }),
      prisma.user.count({ where: { referredById: me.id } }),
      prisma.user.count({
        where: { referredById: me.id, createdAt: { gte: monthAgo } },
      }),
      // Сколько рефералов УЖЕ принесли бонус (= имеют первый paid-заказ).
      prisma.user.count({
        where: { referredById: me.id, referrerBonusGiven: true },
      }),
    ]);

    // Реально начисленные stars = (рефералы с первым paid-заказом) × 10.
    const earnedStars = paidBonusCount * REFERRAL_FIRST_ORDER_BONUS;

    return {
      code: me.referralCode,
      link: buildReferralLink(me.referralCode),
      count: totalCount,
      countThisMonth: monthCount,
      earnedStars,
      bonusPerReferral: REFERRAL_FIRST_ORDER_BONUS,
      items: referrals.map((r) => ({
        id: r.id,
        username: r.username,
        firstName: r.firstName,
        lastName: r.lastName,
        avatarUrl: r.avatarLocalPath ?? r.photoUrl ?? null,
        ordersCount: r._count.orders,
        bonusGiven: r.referrerBonusGiven,
        joinedAt: r.createdAt.toISOString(),
      })),
    };
  });
}

function buildReferralLink(code: string): string {
  // Всегда используем `?start=<code>` — короче и работает в обоих режимах
  // (открытие бота из чата и из inline-button). Бот должен на /start
  // редиректить юзера в Mini App.
  const bot = config.TELEGRAM_BOT_USERNAME;
  const start = `?start=${encodeURIComponent(code)}`;
  return bot ? `https://t.me/${bot}${start}` : start;
}
