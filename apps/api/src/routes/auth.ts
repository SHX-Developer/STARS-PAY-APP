import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { validateTelegramInitData, InitDataError } from '../lib/telegram.js';
import { downloadAvatar, fetchAvatarViaBot, deterministicReferralCode } from '../lib/avatar.js';

const AuthBody = z.object({
  initData: z.string().min(1),
  // Опционально: реф-код пригласившего (start_param из Telegram WebApp)
  startParam: z.string().optional(),
});

export async function authRoutes(app: FastifyInstance) {
  // =============================================
  // POST /api/auth/telegram
  // Принимает initData → валидирует → создаёт/обновляет юзера → возвращает JWT + профиль
  // =============================================
  app.post('/auth/telegram', async (req, reply) => {
    const parsed = AuthBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'invalid_body', details: parsed.error.flatten() };
    }
    const { initData, startParam } = parsed.data;

    // 1. Проверяем подпись Telegram
    let payload;
    try {
      payload = validateTelegramInitData(
        initData,
        config.TELEGRAM_BOT_TOKEN,
        config.TELEGRAM_AUTH_TTL,
      );
    } catch (err) {
      const e = err as InitDataError;
      reply.code(401);
      return { error: 'unauthorized', code: e.code ?? 'UNKNOWN', message: e.message };
    }

    if (!payload.user) {
      reply.code(400);
      return { error: 'no_user_in_init_data' };
    }
    const tg = payload.user;
    const telegramId = BigInt(tg.id);

    // 2. Ищем юзера или создаём
    const existing = await prisma.user.findUnique({ where: { telegramId } });

    // Скачиваем аватарку (фоном, но ждём результата чтобы сохранить путь)
    let avatarPath: string | null = existing?.avatarLocalPath ?? null;
    const avatarChanged = !existing || existing.photoUrl !== (tg.photo_url ?? null);
    if (avatarChanged) {
      avatarPath = await downloadAvatar(telegramId, tg.photo_url);
      if (!avatarPath) {
        // Фолбек: попробуем через Bot API
        avatarPath = await fetchAvatarViaBot(telegramId, config.TELEGRAM_BOT_TOKEN);
      }
    }

    // 3. Реф-связка (только при первом создании)
    let referredById: string | undefined;
    if (!existing && startParam) {
      const inviter = await prisma.user.findFirst({
        where: { referralCode: startParam },
        select: { id: true },
      });
      if (inviter) referredById = inviter.id;
    }

    const user = await prisma.user.upsert({
      where: { telegramId },
      create: {
        telegramId,
        username: tg.username ?? null,
        firstName: tg.first_name,
        lastName: tg.last_name ?? null,
        languageCode: tg.language_code ?? null,
        isPremium: tg.is_premium ?? false,
        photoUrl: tg.photo_url ?? null,
        avatarLocalPath: avatarPath,
        referralCode: deterministicReferralCode(telegramId),
        ...(referredById ? { referredById } : {}),
      },
      update: {
        username: tg.username ?? null,
        firstName: tg.first_name,
        lastName: tg.last_name ?? null,
        languageCode: tg.language_code ?? null,
        isPremium: tg.is_premium ?? false,
        photoUrl: tg.photo_url ?? null,
        ...(avatarChanged ? { avatarLocalPath: avatarPath } : {}),
        lastSeenAt: new Date(),
      },
    });

    // 4. Подписываем JWT
    const token = await reply.jwtSign(
      {
        sub: user.id,
        tgId: user.telegramId.toString(),
      },
      { expiresIn: config.JWT_EXPIRES_IN },
    );

    return {
      token,
      user: serializeUser(user),
    };
  });
}

export function serializeUser(u: {
  id: string;
  telegramId: bigint;
  username: string | null;
  firstName: string;
  lastName: string | null;
  languageCode: string | null;
  isPremium: boolean;
  photoUrl: string | null;
  avatarLocalPath: string | null;
  sparkleBalance: number;
  tier: string;
  referralCode: string;
  createdAt: Date;
}) {
  return {
    id: u.id,
    telegramId: u.telegramId.toString(),
    username: u.username,
    firstName: u.firstName,
    lastName: u.lastName,
    languageCode: u.languageCode,
    isPremium: u.isPremium,
    // Предпочитаем локально сохранённую аватарку, если есть
    avatarUrl: u.avatarLocalPath ?? u.photoUrl ?? null,
    sparkleBalance: u.sparkleBalance,
    tier: u.tier,
    referralCode: u.referralCode,
    createdAt: u.createdAt.toISOString(),
  };
}
