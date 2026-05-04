import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { serializeUser } from './auth.js';

export async function meRoutes(app: FastifyInstance) {
  // =============================================
  // GET /api/me — профиль текущего юзера (по JWT)
  // =============================================
  app.get('/me', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      reply.code(404);
      return { error: 'user_not_found' };
    }
    const referralsCount = await prisma.user.count({ where: { referredById: user.id } });
    return {
      user: serializeUser(user),
      stats: {
        referrals: referralsCount,
      },
    };
  });
}
