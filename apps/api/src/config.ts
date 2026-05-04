import { z } from 'zod';

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

  // JWT — для подписи сессионного токена, выдаваемого фронту
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // CORS — список разрешённых origin через запятую (https://app.example.com,...)
  CORS_ORIGINS: z.string().default('*'),

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
