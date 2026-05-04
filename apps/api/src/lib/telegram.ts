import { createHmac } from 'node:crypto';

// =====================================================
// Telegram WebApp initData validation
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// =====================================================

export interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  allows_write_to_pm?: boolean;
  photo_url?: string;
}

export interface TelegramInitData {
  user?: TelegramUser;
  chat_instance?: string;
  chat_type?: string;
  start_param?: string;
  auth_date: number;
  hash: string;
  signature?: string;
  query_id?: string;
}

export class InitDataError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'InitDataError';
  }
}

/**
 * Парсит и валидирует initData строку, полученную от Telegram WebApp.
 *
 * @param initDataRaw — строка вида "user=...&auth_date=...&hash=..."
 * @param botToken    — токен бота от @BotFather
 * @param ttlSeconds  — TTL после auth_date (защита от replay)
 */
export function validateTelegramInitData(
  initDataRaw: string,
  botToken: string,
  ttlSeconds = 86400,
): TelegramInitData {
  if (!initDataRaw) {
    throw new InitDataError('initData is empty', 'EMPTY');
  }

  const params = new URLSearchParams(initDataRaw);
  const hash = params.get('hash');
  if (!hash) throw new InitDataError('hash is missing', 'NO_HASH');

  // 1. Собираем data_check_string: все поля кроме hash, отсортированные, формата key=value, разделитель \n
  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === 'hash' || key === 'signature') continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  // 2. secret_key = HMAC_SHA256(bot_token, "WebAppData")
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();

  // 3. computed = HMAC_SHA256(data_check_string, secret_key)
  const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  // 4. Сравнение в постоянное время (защита от timing-атак)
  if (!safeCompare(computedHash, hash)) {
    throw new InitDataError('hash mismatch — request not from Telegram', 'BAD_HASH');
  }

  // 5. Парсим поля
  const authDate = Number(params.get('auth_date') ?? 0);
  if (!authDate || Number.isNaN(authDate)) {
    throw new InitDataError('auth_date is invalid', 'BAD_AUTH_DATE');
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - authDate > ttlSeconds) {
    throw new InitDataError('initData expired', 'EXPIRED');
  }

  let user: TelegramUser | undefined;
  const userRaw = params.get('user');
  if (userRaw) {
    try {
      user = JSON.parse(userRaw) as TelegramUser;
    } catch {
      throw new InitDataError('user JSON is malformed', 'BAD_USER');
    }
  }

  return {
    user,
    chat_instance: params.get('chat_instance') ?? undefined,
    chat_type: params.get('chat_type') ?? undefined,
    start_param: params.get('start_param') ?? undefined,
    query_id: params.get('query_id') ?? undefined,
    auth_date: authDate,
    hash,
    signature: params.get('signature') ?? undefined,
  };
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
