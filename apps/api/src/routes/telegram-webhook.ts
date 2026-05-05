import type { FastifyInstance, FastifyRequest } from 'fastify';
import { request } from 'undici';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { creditReferralSignupBonus } from '../lib/referral-bonus.js';
import { deterministicReferralCode } from '../lib/avatar.js';
import { handleOrderCallback } from '../lib/order-channel.js';

// =====================================================
// POST /api/telegram/webhook
// Telegram → этот endpoint при каждом сообщении в боте + callback_query.
// =====================================================

interface TgUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      is_premium?: boolean;
    };
    chat: { id: number; type: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number };
    message?: { message_id: number; chat: { id: number } };
    data?: string;
  };
}

export async function telegramWebhookRoutes(app: FastifyInstance) {
  app.post('/telegram/webhook', async (req, reply) => {
    const expected = config.TELEGRAM_WEBHOOK_SECRET;
    if (!expected) {
      req.log.warn('webhook called but TELEGRAM_WEBHOOK_SECRET is not set');
      reply.code(200);
      return { ok: false, reason: 'not_configured' };
    }
    const got = req.headers['x-telegram-bot-api-secret-token'];
    if (got !== expected) {
      req.log.warn({ got: typeof got }, 'webhook secret mismatch');
      reply.code(401);
      return { error: 'unauthorized' };
    }

    const update = req.body as TgUpdate;

    // 1. /start [ref_code]
    const message = update.message;
    if (message?.text && message.from && !message.from.is_bot) {
      const m = /^\/start(?:\s+(\S+))?/.exec(message.text);
      if (m) {
        const refCode = m[1];
        // fire-and-forget: pre-create + welcome-message
        void handleStart(req, message.chat.id, message.from, refCode).catch((err) => {
          req.log.error({ err }, 'handleStart failed');
        });
      }
    }

    // 2. callback_query (нажатия на кнопки в канале заказов)
    if (update.callback_query) {
      void handleOrderCallback(req, update.callback_query).catch((err) => {
        req.log.error({ err }, 'handleOrderCallback failed');
      });
    }

    reply.code(200);
    return { ok: true };
  });
}

async function handleStart(
  req: FastifyRequest,
  chatId: number,
  from: NonNullable<TgUpdate['message']>['from'] & {},
  refCode?: string,
) {
  // Pre-create user (если ещё не создан) и подвязываем referredById.
  if (from) {
    await ensureUserWithReferral(from, refCode);
  }

  await sendWelcomeMessage(chatId, refCode);
}

async function ensureUserWithReferral(
  from: NonNullable<NonNullable<TgUpdate['message']>['from']>,
  refCode?: string,
): Promise<void> {
  const telegramId = BigInt(from.id);

  // Уже существует?
  const existing = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true, referredById: true },
  });
  if (existing) {
    // Юзер есть — рефа не меняем (он либо уже привязан, либо нет — не наше дело).
    return;
  }

  // Ищем пригласителя по ref-коду
  let referredById: string | undefined;
  if (refCode) {
    const inviter = await prisma.user.findFirst({
      where: { referralCode: refCode },
      select: { id: true },
    });
    if (inviter) referredById = inviter.id;
  }

  // Создаём юзера. Все доп. поля (photo_url, language_code) подтянет
  // /api/auth/telegram при первом открытии Mini App (через upsert update).
  const created = await prisma.user.create({
    data: {
      telegramId,
      firstName: from.first_name,
      lastName: from.last_name ?? null,
      username: from.username ?? null,
      languageCode: from.language_code ?? null,
      isPremium: from.is_premium ?? false,
      referralCode: deterministicReferralCode(telegramId),
      ...(referredById ? { referredById } : {}),
    },
  });

  // Зачисляем signup-бонус пригласителю (helper идемпотентный)
  if (created.referredById) {
    try {
      await creditReferralSignupBonus(created.referredById, created.id);
    } catch {
      // не фейлим обработку /start если bonus упал
    }
  }
}

async function sendWelcomeMessage(chatId: number, refCode?: string) {
  const webAppUrl = buildWebAppUrl(refCode);
  const caption =
    '✨ Welcome to StarsPay\n\n' +
    'Buy Telegram Stars and Premium with the lowest commission. ' +
    'Tap the button below to open the app.';

  const reply_markup = {
    inline_keyboard: [
      [
        webAppUrl
          ? { text: '⭐️ Open StarsPay', web_app: { url: webAppUrl } }
          : { text: '⭐️ Open StarsPay', url: 'https://t.me/' },
      ],
    ],
  };

  const photo = config.WELCOME_IMAGE_URL;
  const apiBase = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}`;
  const target = photo ? `${apiBase}/sendPhoto` : `${apiBase}/sendMessage`;
  const body = photo
    ? { chat_id: chatId, photo, caption, reply_markup }
    : { chat_id: chatId, text: caption, reply_markup };
  await request(target, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    headersTimeout: config.TELEGRAM_API_TIMEOUT_MS,
    bodyTimeout: config.TELEGRAM_API_TIMEOUT_MS,
  });
}

function buildWebAppUrl(refCode?: string): string | null {
  const base = config.TELEGRAM_WEBAPP_URL;
  if (!base) return null;
  if (!refCode) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}start=${encodeURIComponent(refCode)}`;
}
