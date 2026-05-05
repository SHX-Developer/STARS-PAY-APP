import type { FastifyBaseLogger } from 'fastify';
import { request } from 'undici';
import { config } from '../config.js';

interface TelegramApiResponse {
  ok: boolean;
  result?: unknown;
  description?: string;
  error_code?: number;
}

export async function setupTelegramWebhook(logger: FastifyBaseLogger) {
  const secret = config.TELEGRAM_WEBHOOK_SECRET;
  const url = getTelegramWebhookUrl();

  if (!secret) {
    logger.warn('TELEGRAM_WEBHOOK_SECRET is not set; Telegram webhook auto-setup skipped');
    return;
  }

  if (!url) {
    logger.warn('TELEGRAM_WEBHOOK_URL or TELEGRAM_WEBAPP_URL is not set; Telegram webhook auto-setup skipped');
    return;
  }

  const apiUrl = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/setWebhook`;
  const res = await request(apiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      url,
      secret_token: secret,
      allowed_updates: ['message'],
    }),
  });

  const body = (await res.body.json()) as TelegramApiResponse;
  if (!body.ok) {
    logger.error(
      { statusCode: res.statusCode, errorCode: body.error_code, description: body.description },
      'Telegram webhook setup failed',
    );
    return;
  }

  logger.info({ url }, 'Telegram webhook configured');
}

function getTelegramWebhookUrl(): string | null {
  if (config.TELEGRAM_WEBHOOK_URL) return config.TELEGRAM_WEBHOOK_URL;
  if (!config.TELEGRAM_WEBAPP_URL) return null;

  const url = new URL(config.TELEGRAM_WEBAPP_URL);
  url.pathname = '/api/telegram/webhook';
  url.search = '';
  url.hash = '';
  return url.toString();
}
