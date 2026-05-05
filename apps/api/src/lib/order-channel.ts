import type { FastifyRequest } from 'fastify';
import { request } from 'undici';
import { config } from '../config.js';
import { prisma } from './prisma.js';
import { maybeCreditReferralBonus } from './referral-bonus.js';

// =====================================================
// Канал заказов: при создании ордера пушим админам пост с кнопками.
// При нажатии на inline-button — обновляем статус и редактируем пост.
// =====================================================

interface OrderForChannel {
  id: string;
  number: number;
  kind: string;
  recipientUsername: string;
  amount: number;
  priceUsd: { toString(): string } | string | number;
  status: string;
  receiptUrl: string | null;
  user: { firstName: string; username: string | null; telegramId: bigint };
}

const TG_API = (path: string) =>
  `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/${path}`;

/**
 * Отправляет (или с фото если есть receiptUrl) пост в админ-канал.
 * Возвращает message_id чтобы потом редактировать пост.
 */
export async function postOrderToChannel(order: OrderForChannel): Promise<number | null> {
  const channel = config.TELEGRAM_ORDER_CHANNEL;
  if (!channel) return null;

  const text = renderOrderText(order);
  const reply_markup = orderInlineKeyboard(order.id, order.status);

  try {
    const target = order.receiptUrl ? TG_API('sendPhoto') : TG_API('sendMessage');
    const body = order.receiptUrl
      ? {
          chat_id: channel,
          photo: order.receiptUrl,
          caption: text,
          parse_mode: 'HTML' as const,
          reply_markup,
        }
      : {
          chat_id: channel,
          text,
          parse_mode: 'HTML' as const,
          reply_markup,
        };
    const res = await request(target, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      headersTimeout: config.TELEGRAM_API_TIMEOUT_MS,
      bodyTimeout: config.TELEGRAM_API_TIMEOUT_MS,
    });
    const json = (await res.body.json()) as {
      ok: boolean;
      result?: { message_id: number };
    };
    return json.result?.message_id ?? null;
  } catch {
    return null;
  }
}

function renderOrderText(o: OrderForChannel): string {
  const isStars = o.kind === 'stars';
  const title = isStars
    ? `${o.amount} ⭐ Stars`
    : `Telegram Premium · ${o.amount} ${o.amount === 1 ? 'month' : 'months'}`;
  const buyer = o.user.username
    ? `@${escapeHtml(o.user.username)}`
    : escapeHtml(o.user.firstName);
  const price = String(o.priceUsd);
  return [
    `<b>#${o.number} · ${title}</b>`,
    ``,
    `<b>Recipient:</b> @${escapeHtml(o.recipientUsername)}`,
    `<b>Buyer:</b> ${buyer} (id ${o.user.telegramId.toString()})`,
    `<b>Amount:</b> ${o.amount}`,
    `<b>Total:</b> ${price} UZS`,
    `<b>Status:</b> ${statusEmoji(o.status)} ${o.status}`,
  ].join('\n');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&'
      ? '&amp;'
      : c === '<'
        ? '&lt;'
        : c === '>'
          ? '&gt;'
          : c === '"'
            ? '&quot;'
            : '&#39;',
  );
}

function statusEmoji(status: string): string {
  switch (status) {
    case 'paid':
      return '💸';
    case 'delivering':
      return '📦';
    case 'delivered':
      return '✅';
    case 'failed':
      return '⚠️';
    case 'cancelled':
      return '❌';
    default:
      return '🆕';
  }
}

/**
 * Inline-keyboard для админов с кнопками статусов в зависимости
 * от текущего state. Завершённые состояния (delivered/cancelled) не дают
 * кнопок, потому что менять некуда.
 */
function orderInlineKeyboard(orderId: string, status: string) {
  if (status === 'delivered' || status === 'cancelled') return undefined;
  const buttons: { text: string; callback_data: string }[] = [];
  if (status !== 'delivering') {
    buttons.push({ text: '📦 Delivering', callback_data: `o:${orderId}:delivering` });
  }
  if (status !== 'delivered') {
    buttons.push({ text: '✅ Delivered', callback_data: `o:${orderId}:delivered` });
  }
  if (status !== 'cancelled') {
    buttons.push({ text: '❌ Cancel', callback_data: `o:${orderId}:cancelled` });
  }
  // Раскладываем по 2 в ряд
  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }
  return { inline_keyboard: rows };
}

// =====================================================
// callback_query handler — нажатие кнопок в канале
// =====================================================

interface CallbackQuery {
  id: string;
  from: { id: number };
  message?: { message_id: number; chat: { id: number } };
  data?: string;
}

const NEXT_STATUS_FIELDS: Record<string, 'deliveringAt' | 'deliveredAt' | null> = {
  delivering: 'deliveringAt',
  delivered: 'deliveredAt',
  cancelled: null,
};

export async function handleOrderCallback(req: FastifyRequest, q: CallbackQuery): Promise<void> {
  const data = q.data ?? '';
  const m = /^o:([^:]+):(\w+)$/.exec(data);
  if (!m) {
    await answerCallback(q.id, 'Unknown action');
    return;
  }
  const [, orderId, nextStatus] = m;
  if (!orderId || !nextStatus || !(nextStatus in NEXT_STATUS_FIELDS)) {
    await answerCallback(q.id, 'Bad payload');
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: {
        select: { firstName: true, username: true, telegramId: true },
      },
    },
  });
  if (!order) {
    await answerCallback(q.id, 'Order not found');
    return;
  }

  const stamp = NEXT_STATUS_FIELDS[nextStatus];
  const now = new Date();
  const data2: {
    status: string;
    deliveringAt?: Date;
    deliveredAt?: Date;
    paidAt?: Date;
  } = { status: nextStatus };
  if (stamp === 'deliveringAt') data2.deliveringAt = now;
  if (stamp === 'deliveredAt') {
    data2.deliveredAt = now;
    if (!order.deliveringAt) data2.deliveringAt = now;
  }
  // Если ещё не было paidAt — выставим, чтобы timeline был согласован
  if (!order.paidAt && nextStatus !== 'cancelled') {
    data2.paidAt = order.paidAt ?? now;
  }

  const updated = await prisma.order.update({ where: { id: orderId }, data: data2 });

  // Если перешли в "delivered" — это первый успешный заказ юзера → бонус рефереру
  if (nextStatus === 'delivered') {
    try {
      await maybeCreditReferralBonus(order.userId);
    } catch (err) {
      req.log.error({ err }, 'maybeCreditReferralBonus failed');
    }
  }

  // Редактируем пост в канале
  if (q.message && order.channelMessageId) {
    await editOrderMessage(
      q.message.chat.id,
      order.channelMessageId,
      {
        ...order,
        ...updated,
        user: order.user,
      },
      Boolean(order.receiptUrl),
    );
  }

  await answerCallback(q.id, `Status: ${nextStatus}`);
}

async function editOrderMessage(
  chatId: number,
  messageId: number,
  order: OrderForChannel,
  hasPhoto: boolean,
) {
  const text = renderOrderText(order);
  const reply_markup = orderInlineKeyboard(order.id, order.status);
  const target = hasPhoto ? TG_API('editMessageCaption') : TG_API('editMessageText');
  const body = hasPhoto
    ? {
        chat_id: chatId,
        message_id: messageId,
        caption: text,
        parse_mode: 'HTML' as const,
        reply_markup,
      }
    : {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML' as const,
        reply_markup,
      };
  try {
    await request(target, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      headersTimeout: config.TELEGRAM_API_TIMEOUT_MS,
      bodyTimeout: config.TELEGRAM_API_TIMEOUT_MS,
    });
  } catch {
    /* noop */
  }
}

async function answerCallback(id: string, text: string) {
  try {
    await request(TG_API('answerCallbackQuery'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ callback_query_id: id, text }),
      headersTimeout: config.TELEGRAM_API_TIMEOUT_MS,
      bodyTimeout: config.TELEGRAM_API_TIMEOUT_MS,
    });
  } catch {
    /* noop */
  }
}
