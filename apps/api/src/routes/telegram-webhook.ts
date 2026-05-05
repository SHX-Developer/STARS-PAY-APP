import type { FastifyInstance } from 'fastify';
import { request } from 'undici';
import { config } from '../config.js';

// =====================================================
// POST /api/telegram/webhook
// Telegram → наш endpoint при каждом сообщении в боте.
// Реагируем только на /start (с опциональным реф-кодом).
// =====================================================
//
// Безопасность:
//   1. Telegram кладёт TELEGRAM_WEBHOOK_SECRET в заголовок
//      X-Telegram-Bot-Api-Secret-Token. Проверяем его.
//   2. Если секрет не задан в env — webhook отключен.
//
// Setup (один раз после деплоя):
//   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
//        -d "url=https://<ваш-домен>/api/telegram/webhook" \
//        -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
// =====================================================

interface TgUpdate {
  message?: {
    message_id: number;
    from?: { id: number; is_bot: boolean; first_name: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
  };
}

export async function telegramWebhookRoutes(app: FastifyInstance) {
  app.post('/telegram/webhook', async (req, reply) => {
    // Сразу отвечаем 200 — Telegram повторно стучится, если ответ медленный.
    // Плюс — если что-то упало внутри, Telegram не будет долбить ретраями.
    const expected = config.TELEGRAM_WEBHOOK_SECRET;
    if (!expected) {
      // Если webhook не сконфигурён — игнорируем тихо (но логируем).
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
    const message = update.message;
    if (!message?.text || !message.chat) {
      reply.code(200);
      return { ok: true };
    }

    // /start [ref_code]
    const match = /^\/start(?:\s+(\S+))?/.exec(message.text);
    if (match) {
      const refCode = match[1];
      // Не блокируем ответ Telegram — fire-and-forget, ошибки логируем.
      void sendWelcomeMessage(message.chat.id, refCode).catch((err) => {
        req.log.error({ err }, 'sendWelcomeMessage failed');
      });
    }

    reply.code(200);
    return { ok: true };
  });
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

  // Если задан WELCOME_IMAGE_URL — sendPhoto, иначе sendMessage.
  const photo = config.WELCOME_IMAGE_URL;
  const apiBase = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}`;
  if (photo) {
    await request(`${apiBase}/sendPhoto`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo,
        caption,
        reply_markup,
      }),
    });
  } else {
    await request(`${apiBase}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: caption,
        reply_markup,
      }),
    });
  }
}

function buildWebAppUrl(refCode?: string): string | null {
  const base = config.TELEGRAM_WEBAPP_URL;
  if (!base) return null;
  if (!refCode) return base;
  // прокинем ref-код в Mini App через ?start=<code>
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}start=${encodeURIComponent(refCode)}`;
}
