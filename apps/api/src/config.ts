import { z } from 'zod';

// Делает поле опциональным И трактует пустую строку как undefined.
// Нужно потому что docker-compose `${VAR:-}` приходит как "" — а zod.url()
// пустую строку принимает за невалидный URL и роняет процесс.
function emptyToUndef<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((v) => (v === '' ? undefined : v), schema.optional());
}

// =====================================================
// Валидация и парсинг переменных окружения
// =====================================================
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),

  // PostgreSQL — собирается Docker-compose автоматически
  DATABASE_URL: z.string().url(),

  // Telegram bot — токен @BotFather, нужен для проверки initData и скачивания аватарки
  TELEGRAM_BOT_TOKEN: z.string().min(10),
  // Срок жизни initData в секундах (защита от replay)
  TELEGRAM_AUTH_TTL: z.coerce.number().int().positive().default(86400),

  // Юзернейм бота (без @) — нужен для построения реф-ссылок вида
  // https://t.me/<bot>/<app>?startapp=<code>
  // Пустая строка из docker-compose ${VAR:-} нормализуется в undefined.
  TELEGRAM_BOT_USERNAME: emptyToUndef(z.string().min(1)),
  // Короткое имя Mini App, заданное в BotFather (`/newapp`).
  TELEGRAM_MINIAPP_NAME: emptyToUndef(z.string().min(1)),

  // Webhook-секрет (X-Telegram-Bot-Api-Secret-Token).
  // Сгенерировать: `openssl rand -hex 32`.
  TELEGRAM_WEBHOOK_SECRET: emptyToUndef(z.string().min(8)),
  // Полный публичный webhook URL. Если не задан, собирается из TELEGRAM_WEBAPP_URL:
  // https://<domain>/api/telegram/webhook
  TELEGRAM_WEBHOOK_URL: emptyToUndef(z.string().url()),

  // Публичный URL Mini App (https://stars.example.com).
  TELEGRAM_WEBAPP_URL: emptyToUndef(z.string().url()),

  // Telegram IDs админов через запятую. Только они видят /api/admin.
  ADMIN_TELEGRAM_IDS: z.preprocess((v) => (v === '' || v == null ? '' : v), z.string()),

  // URL приветственной картинки.
  WELCOME_IMAGE_URL: emptyToUndef(z.string().url()),

  // ID канала (или группы) для пересылки заказов админам.
  // Бот должен быть админом канала. Формат: "-1001234567890".
  TELEGRAM_ORDER_CHANNEL: emptyToUndef(z.string()),

  // Опциональный API фактической выдачи Stars/Premium.
  // POST получает JSON с orderId/orderNumber/kind/recipientUsername/amount/priceUzs.
  ORDER_DELIVERY_API_URL: emptyToUndef(z.string().url()),
  ORDER_DELIVERY_API_KEY: emptyToUndef(z.string()),
  ORDER_DELIVERY_API_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),

  // Опциональный API для автоматического вывода внутреннего stars-баланса.
  WITHDRAWAL_DELIVERY_API_URL: emptyToUndef(z.string().url()),
  WITHDRAWAL_DELIVERY_API_KEY: emptyToUndef(z.string()),
  WITHDRAWAL_DELIVERY_API_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),

  // Таймаут общих внешних http-запросов (Bot API, Buypin) в мс.
  TELEGRAM_API_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

  // Buypin (внешний lookup API) — имя/премиум-статус по @username.
  EXTERNAL_API_BASE_URL: emptyToUndef(z.string().url()),
  EXTERNAL_API_KEY: emptyToUndef(z.string().min(8)),
  // Game-key из GET /games для валидации Telegram-юзеров.
  // По умолчанию 'telegram-stars'. Узнать список ключей:
  //   curl -H "X-API-Key: <key>" https://buypin.net/api/v1/games
  BUYPIN_GAME_KEY: z.preprocess(
    (v) => (v === '' || v == null ? 'telegram-stars' : v),
    z.string().min(1),
  ),
  // Game-key для проверки Telegram Premium подписки. Buypin отвечает 200/success
  // только если у юзера активная Premium-подписка (иначе 422 "validation failed").
  BUYPIN_PREMIUM_GAME_KEY: z.preprocess(
    (v) => (v === '' || v == null ? 'telegram-premium' : v),
    z.string().min(1),
  ),

  // Yandex Cloud Object Storage (S3-совместимый) — для чеков и любых файлов.
  AWS_REGION: emptyToUndef(z.string()),
  AWS_ACCESS_KEY_ID: emptyToUndef(z.string()),
  AWS_SECRET_ACCESS_KEY: emptyToUndef(z.string()),
  AWS_S3_BUCKET: emptyToUndef(z.string()),
  AWS_S3_ENDPOINT: emptyToUndef(z.string().url()),
  AWS_S3_FORCE_PATH_STYLE: z.preprocess(
    (v) => (v === '' || v == null ? false : String(v).toLowerCase() === 'true'),
    z.boolean(),
  ),
  AWS_S3_PUBLIC_BASE: emptyToUndef(z.string().url()),

  // JWT — для подписи сессионного токена, выдаваемого фронту
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // CORS — список разрешённых origin через запятую (https://app.example.com,...)
  // Пустая строка из docker-compose трактуется как '*'.
  CORS_ORIGINS: z.preprocess((v) => (v === '' || v == null ? '*' : v), z.string()),

  // Где хранить локально скачанные аватарки (внутри контейнера)
  AVATAR_DIR: z.string().default('/app/data/avatars'),
  // Публичный префикс, по которому отдаются аватарки (api сам сервит /avatars/<file>)
  AVATAR_PUBLIC_PREFIX: z.string().default('/avatars'),

  // Лог-уровень
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;

export const isDev = config.NODE_ENV === 'development';
export const isProd = config.NODE_ENV === 'production';
