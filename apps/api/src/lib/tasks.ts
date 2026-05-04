import { prisma } from './prisma.js';

// =====================================================
// Хардкод-список заданий. Хранится в коде, при старте upsert-ится в DB,
// чтобы FK из TaskCompletion работал. Чтобы добавить таску — допишите сюда
// и перезапустите api (запись с тем же id будет обновлена).
// =====================================================

export type TaskKind =
  // socials — простой "claim", без верификации (доверяем юзеру)
  | 'channel'
  | 'instagram'
  // верифицируемые — проверяем по реальным данным в БД
  | 'referrals_1'
  | 'referrals_5'
  | 'first_order'
  | 'daily';

export interface DefaultTask {
  id: string;
  title: string;
  subtitle: string;
  reward: number;
  kind: TaskKind;
  url: string | null;
  sort: number;
}

export const DEFAULT_TASKS: DefaultTask[] = [
  {
    id: 'channel-join',
    title: 'Join our channel',
    subtitle: 'Subscribe to news & promos',
    reward: 25,
    kind: 'channel',
    url: 'https://t.me/sparkles_news',
    sort: 1,
  },
  {
    id: 'instagram-follow',
    title: 'Follow on Instagram',
    subtitle: '@sparkles.app',
    reward: 30,
    kind: 'instagram',
    url: 'https://instagram.com/sparkles.app',
    sort: 2,
  },
  {
    id: 'invite-1',
    title: 'Invite 1 friend',
    subtitle: 'Share your referral link',
    reward: 50,
    kind: 'referrals_1',
    url: null,
    sort: 3,
  },
  {
    id: 'first-order',
    title: 'Make your first order',
    subtitle: 'Any star pack',
    reward: 100,
    kind: 'first_order',
    url: null,
    sort: 4,
  },
  {
    id: 'daily-check-in',
    title: 'Daily check-in',
    subtitle: 'Open the app every day',
    reward: 5,
    kind: 'daily',
    url: null,
    sort: 5,
  },
  {
    id: 'invite-5',
    title: 'Invite 5 friends',
    subtitle: 'Build your network',
    reward: 200,
    kind: 'referrals_5',
    url: null,
    sort: 6,
  },
];

// Маппинг kind → имя иконки (из Icon.tsx)
export function iconForKind(kind: TaskKind): string {
  switch (kind) {
    case 'channel':
      return 'tg';
    case 'instagram':
      return 'instagram';
    case 'referrals_1':
    case 'referrals_5':
      return 'referrals';
    case 'first_order':
      return 'orders';
    case 'daily':
      return 'sparkle';
  }
}

/**
 * Идемпотентно создаёт/обновляет задания в БД при старте API.
 */
export async function seedDefaultTasks(): Promise<void> {
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
// Верификация выполнения. Возвращаем { ok: true } если можно зачислить,
// либо { ok: false, reason } если требование пока не удовлетворено.
// =====================================================

export interface VerifyContext {
  userId: string;
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

export async function verifyTask(kind: TaskKind, ctx: VerifyContext): Promise<VerifyResult> {
  switch (kind) {
    case 'channel':
    case 'instagram':
      // Социальные сети — простой self-claim. Реальная проверка для каналов
      // требует чтобы бот был админом и getChatMember; для Instagram
      // публичного API подписок нет вообще. Доверяем юзеру.
      return { ok: true };

    case 'referrals_1': {
      const cnt = await prisma.user.count({ where: { referredById: ctx.userId } });
      return cnt >= 1 ? { ok: true } : { ok: false, reason: 'Need at least 1 referral' };
    }

    case 'referrals_5': {
      const cnt = await prisma.user.count({ where: { referredById: ctx.userId } });
      return cnt >= 5
        ? { ok: true }
        : { ok: false, reason: `Need ${5 - cnt} more referral${5 - cnt === 1 ? '' : 's'}` };
    }

    case 'first_order': {
      const cnt = await prisma.order.count({
        where: { userId: ctx.userId, status: { in: ['paid', 'completed'] } },
      });
      return cnt >= 1
        ? { ok: true }
        : { ok: false, reason: 'No completed orders yet' };
    }

    case 'daily': {
      // "Уже бывал в приложении сегодня" — если последний lastSeenAt был
      // в течение последних 24ч от текущего момента.
      const u = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { lastSeenAt: true },
      });
      if (!u) return { ok: false, reason: 'User not found' };
      // lastSeenAt обновляется при каждом /api/auth/telegram. Считаем что
      // пользователь "сегодня заходил" если он сейчас аутентифицирован — это
      // тривиально true. Поэтому проверяем что задание не выполнено сегодня
      // (это уже делается через TaskCompletion @@unique). Здесь просто ok.
      return { ok: true };
    }
  }
}
