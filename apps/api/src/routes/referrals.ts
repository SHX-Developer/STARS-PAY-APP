import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';

// Сколько stars начисляем юзеру за каждый заказ его реферала.
// Это placeholder — потом замените на реальную бизнес-логику (10% от суммы и т.п.).
const STARS_PER_REFERRAL_ORDER = 10;

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

    const [referrals, totalCount, monthCount] = await Promise.all([
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
          _count: { select: { orders: true } },
        },
      }),
      prisma.user.count({ where: { referredById: me.id } }),
      prisma.user.count({
        where: { referredById: me.id, createdAt: { gte: monthAgo } },
      }),
    ]);

    // Сумма всех заказов рефералов × ставка → начисленные stars.
    const totalReferralOrders = referrals.reduce((s, r) => s + r._count.orders, 0);
    const earnedStars = totalReferralOrders * STARS_PER_REFERRAL_ORDER;

    return {
      code: me.referralCode,
      link: buildReferralLink(me.referralCode),
      count: totalCount,
      countThisMonth: monthCount,
      earnedStars,
      items: referrals.map((r) => ({
        id: r.id,
        username: r.username,
        firstName: r.firstName,
        lastName: r.lastName,
        avatarUrl: r.avatarLocalPath ?? r.photoUrl ?? null,
        ordersCount: r._count.orders,
        joinedAt: r.createdAt.toISOString(),
      })),
    };
  });
}

function buildReferralLink(code: string): string {
  const bot = config.TELEGRAM_BOT_USERNAME;
  if (!bot) {
    return `?start=${encodeURIComponent(code)}`;
  }
  const app = config.TELEGRAM_MINIAPP_NAME;
  return app
    ? `https://t.me/${bot}/${app}?startapp=${encodeURIComponent(code)}`
    : `https://t.me/${bot}?start=${encodeURIComponent(code)}`;
}
