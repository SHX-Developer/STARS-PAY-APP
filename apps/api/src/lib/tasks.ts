import { request } from 'undici';
import { prisma } from './prisma.js';
import { config } from '../config.js';

// =====================================================
// Список заданий — хранится в коде, при старте upsert-ится в DB,
// чтобы FK из TaskCompletion работал.
// Чтобы добавить таску — допишите сюда и перезапустите api (запись с тем же
// id будет обновлена). Поле `params` в БД НЕ хранится: оно используется
// только верификатором (см. verifyTask).
// =====================================================

export type TaskKind =
  | 'channel'      // params.chatId — проверяем через Bot API getChatMember
  | 'instagram'    // self-claim, без верификации
  | 'buy_stars'    // params.starsAmount — нужен заказ kind=stars amount>=N
  | 'buy_premium'; // params.premiumMonths — нужен заказ kind=premium amount=N

export interface TaskParams {
  chatId?: string;        // @username или -100... id канала
  starsAmount?: number;   // минимальное количество stars в заказе
  premiumMonths?: number; // ровно столько месяцев Premium
}

export interface DefaultTask {
  id: string;
  title: string;
  subtitle: string;
  reward: number;
  kind: TaskKind;
  url: string | null;
  sort: number;
  params?: TaskParams;
}

// Заказы со статусом "выполнено" — что считаем валидной покупкой
const FULFILLED_STATUSES = ['paid', 'delivering', 'delivered', 'completed'] as const;

export const DEFAULT_TASKS: DefaultTask[] = [
  // -------- Социалки --------
  {
    id: 'channel-starspay',
    title: 'Subscribe to our channel',
    subtitle: '@StarsPayChannel',
    reward: 10,
    kind: 'channel',
    url: 'https://t.me/StarsPayChannel',
    sort: 1,
    params: { chatId: '@StarsPayChannel' },
  },
  {
    id: 'instagram-starspay',
    title: 'Follow on Instagram',
    subtitle: '@starspayofficial',
    reward: 10,
    kind: 'instagram',
    url: 'https://www.instagram.com/starspayofficial/',
    sort: 2,
  },

  // -------- Покупки stars --------
  {
    id: 'buy-stars-50',
    title: 'Buy 50 stars',
    subtitle: 'Any pack ≥ 50',
    reward: 5,
    kind: 'buy_stars',
    url: null,
    sort: 3,
    params: { starsAmount: 50 },
  },
  {
    id: 'buy-stars-100',
    title: 'Buy 100 stars',
    subtitle: 'Any pack ≥ 100',
    reward: 10,
    kind: 'buy_stars',
    url: null,
    sort: 4,
    params: { starsAmount: 100 },
  },
  {
    id: 'buy-stars-500',
    title: 'Buy 500 stars',
    subtitle: 'Any pack ≥ 500',
    reward: 50,
    kind: 'buy_stars',
    url: null,
    sort: 5,
    params: { starsAmount: 500 },
  },
  {
    id: 'buy-stars-1000',
    title: 'Buy 1000 stars',
    subtitle: 'Any pack ≥ 1000',
    reward: 100,
    kind: 'buy_stars',
    url: null,
    sort: 6,
    params: { starsAmount: 1000 },
  },

  // -------- Покупки Premium --------
  {
    id: 'buy-premium-3',
    title: 'Buy Premium 3 months',
    subtitle: 'Any account',
    reward: 50,
    kind: 'buy_premium',
    url: null,
    sort: 7,
    params: { premiumMonths: 3 },
  },
  {
    id: 'buy-premium-6',
    title: 'Buy Premium 6 months',
    subtitle: 'Any account',
    reward: 100,
    kind: 'buy_premium',
    url: null,
    sort: 8,
    params: { premiumMonths: 6 },
  },
  {
    id: 'buy-premium-12',
    title: 'Buy Premium 12 months',
    subtitle: 'Any account',
    reward: 200,
    kind: 'buy_premium',
    url: null,
    sort: 9,
    params: { premiumMonths: 12 },
  },
];

const TASK_BY_ID: Map<string, DefaultTask> = new Map(DEFAULT_TASKS.map((t) => [t.id, t]));

// Маппинг kind → имя иконки (из Icon.tsx)
export function iconForKind(kind: TaskKind): string {
  switch (kind) {
    case 'channel':
      return 'tg';
    case 'instagram':
      return 'instagram';
    case 'buy_stars':
      return 'home'; // 4-point star из Icon.tsx
    case 'buy_premium':
      return 'sparkle';
  }
}

/**
 * Идемпотентно создаёт/обновляет задания в БД при старте API.
 */
export async function seedDefaultTasks(): Promise<void> {
  // Деактивируем все таски сначала, чтобы убрать те, которые удалили из кода
  await prisma.task.updateMany({ data: { active: false } });
  for (const t of DEFAULT_TASKS) {
    await prisma.task.upsert({
      where: { id: t.id },
      create: {
        id: t.id,
        title: t.title,
        description: t.subtitle,
        reward: t.reward,
        kind: t.kind,
        url: t.url,
        sort: t.sort,
        active: true,
      },
      update: {
        title: t.title,
        description: t.subtitle,
        reward: t.reward,
        kind: t.kind,
        url: t.url,
        sort: t.sort,
        active: true,
      },
    });
  }
}

// =====================================================
// Верификация
// =====================================================

export interface VerifyContext {
  userId: string;
  telegramId: bigint;
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

export async function verifyTask(taskId: string, ctx: VerifyContext): Promise<VerifyResult> {
  const def = TASK_BY_ID.get(taskId);
  if (!def) return { ok: false, reason: 'unknown task' };

  switch (def.kind) {
    case 'instagram': {
      // Публичного API подписок у Instagram нет — доверяем юзеру.
      return { ok: true };
    }

    case 'channel': {
      const chatId = def.params?.chatId;
      if (!chatId) return { ok: false, reason: 'channel not configured' };
      return await verifyTelegramSubscription(chatId, ctx.telegramId);
    }

    case 'buy_stars': {
      const min = def.params?.starsAmount ?? 0;
      const found = await prisma.order.findFirst({
        where: {
          userId: ctx.userId,
          kind: 'stars',
          amount: { gte: min },
          status: { in: [...FULFILLED_STATUSES] },
        },
        select: { id: true },
      });
      return found
        ? { ok: true }
        : { ok: false, reason: `Buy at least ${min} stars first` };
    }

    case 'buy_premium': {
      const months = def.params?.premiumMonths ?? 0;
      const found = await prisma.order.findFirst({
        where: {
          userId: ctx.userId,
          kind: 'premium',
          amount: months,
          status: { in: [...FULFILLED_STATUSES] },
        },
        select: { id: true },
      });
      return found
        ? { ok: true }
        : { ok: false, reason: `Buy ${months}-month Premium first` };
    }
  }
}

// =====================================================
// Bot API: getChatMember
// =====================================================
//
// Чтобы это работало, бот должен:
//   1) быть АДМИНОМ канала (или хотя бы участником в публичной группе с правом
//      "Add Members" — для каналов нужны админ-права для getChatMember)
//   2) знать chat_id (формат "@username" работает для публичных каналов)
//
// Если бот не админ — Telegram вернёт 400 "member list is inaccessible".
// =====================================================

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

interface ChatMember {
  status: 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked';
}

async function verifyTelegramSubscription(
  chatId: string,
  telegramId: bigint,
): Promise<VerifyResult> {
  try {
    const url = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/getChatMember`;
    const res = await request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, user_id: telegramId.toString() }),
      headersTimeout: 5_000,
      bodyTimeout: 5_000,
    });
    const json = (await res.body.json()) as TelegramApiResponse<ChatMember>;

    if (!json.ok) {
      // Самая частая причина — бот не админ канала.
      const desc = json.description ?? 'unknown error';
      if (desc.toLowerCase().includes('member list is inaccessible')) {
        return { ok: false, reason: 'Channel verification unavailable. Try later.' };
      }
      if (desc.toLowerCase().includes('user not found')) {
        return { ok: false, reason: 'You are not subscribed to the channel' };
      }
      return { ok: false, reason: desc };
    }

    const status = json.result?.status;
    if (status === 'creator' || status === 'administrator' || status === 'member') {
      return { ok: true };
    }
    return { ok: false, reason: 'Subscribe to the channel first' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'network error';
    return { ok: false, reason: `Verification failed: ${msg}` };
  }
}
