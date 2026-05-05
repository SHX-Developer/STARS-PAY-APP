import type { FastifyInstance } from 'fastify';
import { lookupTelegramUser } from '../lib/buypin.js';

// =====================================================
// GET /api/lookup?username=<u>          — обычный lookup
// GET /api/lookup/raw?username=<u>      — debug, возвращает raw-ответ Buypin
// =====================================================

export async function lookupRoutes(app: FastifyInstance) {
  app.get('/lookup', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { username } = req.query as { username?: string };
    if (!username) {
      reply.code(400);
      return { error: 'username_required' };
    }
    const result = await lookupTelegramUser(username, {
      log: (msg, data) => req.log.info({ buypin: data }, msg),
    });
    if (!result) {
      reply.code(404);
      return { found: false };
    }
    return {
      found: true,
      username: result.username,
      name: result.name,
      isPremium: result.isPremium,
    };
  });

  // Debug — отдаёт всё что вернул Buypin (полезно когда парсер не находит поле).
  app.get('/lookup/raw', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { username } = req.query as { username?: string };
    if (!username) {
      reply.code(400);
      return { error: 'username_required' };
    }
    const result = await lookupTelegramUser(username, {
      log: (msg, data) => req.log.info({ buypin: data }, msg),
    });
    if (!result) {
      reply.code(404);
      return { found: false };
    }
    return result; // включая raw
  });
}
