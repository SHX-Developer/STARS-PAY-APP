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
  receiptUploaded?: boolean;
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

  if (order.receiptUrl) {
    try {
      const photoJson = await botRequest<{ message_id: number }>('sendPhoto', {
        chat_id: channel,
        photo: order.receiptUrl,
        caption: text,
        parse_mode: 'HTML' as const,
        reply_markup,
      });
      return photoJson.result?.message_id ?? null;
    } catch {
      // Если Telegram не смог скачать публичный URL чека, всё равно отправляем заказ
      // текстом, чтобы админский канал не терял заявку.
    }
  }

  const json = await botRequest<{ message_id: number }>('sendMessage', {
    chat_id: channel,
    text,
    parse_mode: 'HTML' as const,
    reply_markup,
  });
  return json.result?.message_id ?? null;
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
  const receiptLine = o.receiptUrl
    ? `<b>Чек:</b> <a href="${escapeHtml(o.receiptUrl)}">открыть</a>`
    : o.receiptUploaded
      ? `<b>Чек:</b> загружен, публичная ссылка недоступна`
      : `<b>Чек:</b> не приложен`;
  return [
    `<b>Новый заказ #${o.number}</b>`,
    `<b>${title}</b>`,
    ``,
    `<b>Получатель:</b> @${escapeHtml(o.recipientUsername)}`,
    `<b>Покупатель:</b> ${buyer} (id ${o.user.telegramId.toString()})`,
    `<b>Количество:</b> ${o.amount}`,
    `<b>Сумма:</b> ${price} UZS`,
    receiptLine,
    `<b>Статус:</b> ${statusEmoji(o.status)} ${statusLabel(o.status)}`,
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

function statusLabel(status: string): string {
  switch (status) {
    case 'paid':
      return 'оплачен';
    case 'delivering':
      return 'выполняется';
    case 'delivered':
      return 'выполнен';
    case 'failed':
      return 'ошибка';
    case 'cancelled':
      return 'отменён';
    default:
      return 'создан';
  }
}

/**
 * Inline-keyboard для админов. "Выполнить" идёт через внешний delivery API,
 * "Выполнить без API" закрывает заказ вручную после реальной ручной выдачи.
 */
function orderInlineKeyboard(orderId: string, status: string) {
  if (status === 'delivered' || status === 'cancelled') return undefined;
  return {
    inline_keyboard: [
      [
        { text: '✅ Выполнить', callback_data: `o:${orderId}:complete` },
        { text: '❌ Отменить', callback_data: `o:${orderId}:cancel` },
      ],
      [{ text: '🛠 Выполнить без API', callback_data: `o:${orderId}:manual` }],
    ],
  };
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

const ORDER_ACTIONS = ['complete', 'manual', 'cancel'] as const;
type OrderAction = (typeof ORDER_ACTIONS)[number];

export async function handleOrderCallback(req: FastifyRequest, q: CallbackQuery): Promise<void> {
  try {
    const data = q.data ?? '';
    const m = /^o:([^:]+):(\w+)$/.exec(data);
    if (!m) {
      await answerCallback(q.id, 'Неизвестное действие', true);
      return;
    }
    const [, orderId, actionRaw] = m;
    const action = actionRaw as OrderAction;
    if (!orderId || !ORDER_ACTIONS.includes(action)) {
      await answerCallback(q.id, 'Некорректная кнопка заказа', true);
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
      await answerCallback(q.id, 'Заказ не найден', true);
      return;
    }
    if (order.status === 'delivered') {
      await answerCallback(q.id, 'Заказ уже выполнен', true);
      return;
    }
    if (order.status === 'cancelled') {
      await answerCallback(q.id, 'Заказ уже отменён', true);
      return;
    }

    if (action === 'complete') {
      await fulfillOrderViaApi(order);
    }

    const updated = await markOrderByAction(order, action);

    if (updated.status === 'delivered') {
      try {
        await maybeCreditReferralBonus(order.userId);
      } catch (err) {
        req.log.error({ err }, 'maybeCreditReferralBonus failed');
      }
    }

    if (q.message && order.channelMessageId) {
      await editOrderMessage(
        q.message.chat.id,
        order.channelMessageId,
        {
          ...order,
          ...updated,
          user: order.user,
          receiptUploaded: Boolean(order.receiptUrl || order.paidAt),
        },
        Boolean(order.receiptUrl),
      );
    }

    await answerCallback(
      q.id,
      action === 'cancel'
        ? 'Заказ отменён'
        : action === 'manual'
          ? 'Заказ выполнен вручную'
          : 'Заказ выполнен через API',
      false,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
    req.log.error({ err }, 'handleOrderCallback failed');
    await answerCallback(q.id, message, true);
  }
}

async function fulfillOrderViaApi(order: OrderForChannel): Promise<void> {
  const url = config.ORDER_DELIVERY_API_URL;
  if (!url) {
    throw new Error('API выдачи не настроен. Используйте "Выполнить без API" после ручной выдачи.');
  }

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (config.ORDER_DELIVERY_API_KEY) {
    headers.authorization = `Bearer ${config.ORDER_DELIVERY_API_KEY}`;
  }

  const res = await request(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      orderId: order.id,
      orderNumber: order.number,
      kind: order.kind,
      recipientUsername: order.recipientUsername,
      amount: order.amount,
      priceUzs: Number(order.priceUsd),
    }),
    headersTimeout: config.ORDER_DELIVERY_API_TIMEOUT_MS,
    bodyTimeout: config.ORDER_DELIVERY_API_TIMEOUT_MS,
  });

  const text = await res.body.text();
  let json: { ok?: boolean; error?: string; message?: string } | null = null;
  try {
    json = text ? JSON.parse(text) as { ok?: boolean; error?: string; message?: string } : null;
  } catch {
    json = null;
  }
  if (res.statusCode < 200 || res.statusCode >= 300 || json?.ok === false) {
    throw new Error(json?.error ?? json?.message ?? `Delivery API error ${res.statusCode}`);
  }
}

async function markOrderByAction(order: { id: string; paidAt: Date | null }, action: OrderAction) {
  const now = new Date();
  if (action === 'cancel') {
    return prisma.order.update({
      where: { id: order.id },
      data: { status: 'cancelled' },
    });
  }
  return prisma.order.update({
    where: { id: order.id },
    data: {
      status: 'delivered',
      paidAt: order.paidAt ?? now,
      deliveringAt: now,
      deliveredAt: now,
    },
  });
}

async function editOrderMessage(
  chatId: number,
  messageId: number,
  order: OrderForChannel,
  hasPhoto: boolean,
) {
  const text = renderOrderText(order);
  const reply_markup = orderInlineKeyboard(order.id, order.status);
  const method = hasPhoto ? 'editMessageCaption' : 'editMessageText';
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
    await botRequest(method, body);
  } catch (err) {
    if (hasPhoto) {
      try {
        await botRequest('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: 'HTML' as const,
          reply_markup,
        });
        return;
      } catch (fallbackErr) {
        throw fallbackErr;
      }
    }
    throw err;
  }
}

async function answerCallback(id: string, text: string, showAlert = false) {
  try {
    await botRequest('answerCallbackQuery', {
      callback_query_id: id,
      text,
      show_alert: showAlert,
    });
  } catch {
    /* noop */
  }
}

interface BotApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

async function botRequest<T>(method: string, body: Record<string, unknown>): Promise<BotApiResponse<T>> {
  const res = await request(TG_API(method), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    headersTimeout: config.TELEGRAM_API_TIMEOUT_MS,
    bodyTimeout: config.TELEGRAM_API_TIMEOUT_MS,
  });
  const json = (await res.body.json()) as BotApiResponse<T>;
  if (!json.ok) {
    throw new Error(json.description ?? `Telegram ${method} failed`);
  }
  return json;
}
