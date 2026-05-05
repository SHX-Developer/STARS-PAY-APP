import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, normalize } from 'node:path';
import { config, isDev } from './config.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { meRoutes } from './routes/me.js';
import { referralRoutes } from './routes/referrals.js';
import { tasksRoutes } from './routes/tasks.js';
import { ordersRoutes } from './routes/orders.js';
import { walletRoutes } from './routes/wallet.js';
import { telegramWebhookRoutes } from './routes/telegram-webhook.js';
import { lookupRoutes } from './routes/lookup.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => Promise<void>;
  }
}

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport: isDev
        ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
        : undefined,
    },
    // 10 MB — multipart с чеком до 8 MB + headers/fields с запасом
    bodyLimit: 10 * 1024 * 1024,
    trustProxy: true, // мы за Traefik в Dokploy
  });

  // CORS
  const origins =
    config.CORS_ORIGINS === '*'
      ? true
      : config.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  await app.register(cors, {
    origin: origins,
    credentials: true,
  });

  // Rate limit (защита от перебора /api/auth/telegram)
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });

  // Multipart — для загрузки чеков в /api/orders
  await app.register(multipart, {
    limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  });

  // JWT
  await app.register(jwt, { secret: config.JWT_SECRET });
  app.decorate('authenticate', async function (req, reply) {
    try {
      await req.jwtVerify();
    } catch {
      reply.code(401).send({ error: 'unauthorized' });
    }
  });

  // Статика для аватарок (без полноценного @fastify/static — отдаём вручную и безопасно)
  app.get(`${config.AVATAR_PUBLIC_PREFIX}/:file`, async (req, reply) => {
    const { file } = req.params as { file: string };
    // Защита от path traversal
    if (file.includes('..') || file.includes('/') || file.includes('\\')) {
      reply.code(400);
      return { error: 'bad_filename' };
    }
    const fullPath = normalize(join(config.AVATAR_DIR, file));
    if (!fullPath.startsWith(normalize(config.AVATAR_DIR))) {
      reply.code(400);
      return { error: 'bad_path' };
    }
    try {
      const s = await stat(fullPath);
      if (!s.isFile()) {
        reply.code(404);
        return { error: 'not_found' };
      }
      reply.header('Cache-Control', 'public, max-age=86400');
      reply.header('Content-Type', guessMime(file));
      return reply.send(createReadStream(fullPath));
    } catch {
      reply.code(404);
      return { error: 'not_found' };
    }
  });

  // Routes
  await app.register(healthRoutes); // /health, /health/ready
  await app.register(
    async (api) => {
      await api.register(authRoutes); // /auth/telegram
      await api.register(meRoutes); // /me
      await api.register(referralRoutes); // /referrals
      await api.register(tasksRoutes); // /tasks, /tasks/:id/check
      await api.register(ordersRoutes); // /orders
      await api.register(walletRoutes); // /transactions, /withdraw
      await api.register(telegramWebhookRoutes); // /telegram/webhook
      await api.register(lookupRoutes); // /lookup
    },
    { prefix: '/api' },
  );

  // 404
  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({ error: 'not_found' });
  });

  // Глобальный обработчик ошибок
  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, 'unhandled');
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    reply.code(status).send({
      error: 'internal_error',
      message: isDev ? err.message : 'something went wrong',
    });
  });

  return app;
}

function guessMime(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}
