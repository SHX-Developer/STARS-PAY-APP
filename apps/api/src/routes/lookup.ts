import type { FastifyInstance } from 'fastify';
import { lookupTelegramUser } from '../lib/buypin.js';

// =====================================================
// GET /api/lookup?username=<u>
// Возвращает имя и premium-статус юзера через Buypin (с кэшем 5 мин).
// =====================================================

export async function lookupRoutes(app: FastifyInstance) {
  app.get('/lookup', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { username } = req.query as { username?: string };
    if (!username) {
      reply.code(400);
      return { error: 'username_required' };
    }
    const result = await lookupTelegramUser(username);
    if (!result) {
      reply.code(404);
      return { found: false };
    }
    return { found: true, ...result };
  });
}
