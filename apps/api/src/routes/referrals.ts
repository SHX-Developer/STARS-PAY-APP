import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';

// =====================================================
// GET /api/referrals
// Возвращает реф-код, реф-ссылку, общее количество приглашённых
// и список юзеров с количеством их заказов.
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

    // Параллельно: список рефералов (с подсчётом заказов) и общее число
    const [referrals, totalCount] = await Promise.all([
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
    ]);

    return {
      code: me.referralCode,
      link: buildReferralLink(me.referralCode),
      count: totalCount,
      items: referrals.map((r) => ({
        id: r.id,
        username: r.username,
        firstName: r.firstName,
        lastName: r.lastName,
        avatarUrl: r.avatarLocalPath ?? r.photoUrl ?? null,
        ordersCount: r._count.orders,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });
}

function buildReferralLink(code: string): string {
  const bot = config.TELEGRAM_BOT_USERNAME;
  if (!bot) {
    // Бот не сконфигурён — отдаём deep-link на копирование. Юзер сам подставит.
    return `?start=${encodeURIComponent(code)}`;
  }
  const app = config.TELEGRAM_MINIAPP_NAME;
  return app
    ? `https://t.me/${bot}/${app}?startapp=${encodeURIComponent(code)}`
    : `https://t.me/${bot}?start=${encodeURIComponent(code)}`;
}
