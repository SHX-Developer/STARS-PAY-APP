import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { maybeCreditReferralBonus } from '../lib/referral-bonus.js';
import { uploadToS3 } from '../lib/s3.js';
import { postOrderToChannel } from '../lib/order-channel.js';

// =====================================================
// POST /api/orders   — создать заказ (multipart с чеком ИЛИ JSON)
// GET  /api/orders   — мои заказы
// =====================================================

const PREMIUM_MONTHS = [3, 6, 12];

interface CreateOrderInput {
  kind: 'stars' | 'premium';
  recipientUsername: string;
  amount: number;
  priceUsd: number;
  receipt?: { buffer: Buffer; mime: string } | null;
}

export async function ordersRoutes(app: FastifyInstance) {
  // ---------- POST /orders ----------
  app.post('/orders', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;

    const input = await parseCreateOrderInput(req);
    if (!input.ok) {
      reply.code(input.statusCode);
      return { error: input.error, details: input.details };
    }
    const { kind, recipientUsername, amount, priceUsd, receipt } = input.value;

    if (kind === 'premium' && !PREMIUM_MONTHS.includes(amount)) {
      reply.code(400);
      return { error: 'invalid_amount', allowed: PREMIUM_MONTHS };
    }
    if (kind === 'stars' && amount <= 0) {
      reply.code(400);
      return { error: 'invalid_amount' };
    }

    // 1. Загружаем чек в S3 (если приложен)
    let receiptUrl: string | null = null;
    if (receipt) {
      try {
        const up = await uploadToS3(receipt.buffer, receipt.mime, 'receipts');
        receiptUrl = up?.url ?? null;
      } catch (err) {
        req.log.error({ err }, 'S3 upload failed');
      }
    }

    // 2. Создаём заказ
    const now = new Date();
    const order = await prisma.order.create({
      data: {
        userId,
        kind,
        recipientUsername,
        amount,
        priceUsd,
        // Если был receipt → сразу paid; иначе created (ждёт ручного подтверждения)
        status: receiptUrl ? 'paid' : 'created',
        paidAt: receiptUrl ? now : null,
        receiptUrl,
      },
      include: {
        user: { select: { firstName: true, username: true, telegramId: true } },
      },
    });

    // 3. Если это первый paid-заказ — пригласителю +10★
    let bonus: { creditedTo?: string; amount?: number } | null = null;
    if (receiptUrl) {
      const r = await maybeCreditReferralBonus(userId);
      if (r.credited) bonus = { creditedTo: r.inviterId, amount: r.amount };
    }

    // 4. Постим в канал админов (если сконфигурён)
    try {
      const messageId = await postOrderToChannel({
        id: order.id,
        number: order.number,
        kind: order.kind,
        recipientUsername: order.recipientUsername,
        amount: order.amount,
        priceUsd: order.priceUsd,
        status: order.status,
        receiptUrl: order.receiptUrl,
        user: order.user,
      });
      if (messageId) {
        await prisma.order.update({
          where: { id: order.id },
          data: { channelMessageId: messageId },
        });
      }
    } catch (err) {
      req.log.error({ err }, 'postOrderToChannel failed');
    }

    return {
      order: serializeOrder(order),
      referralBonus: bonus,
    };
  });

  // ---------- GET /orders ----------
  app.get('/orders', { preHandler: [app.authenticate] }, async (req) => {
    const userId = (req.user as { sub: string }).sub;
    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { items: orders.map(serializeOrder) };
  });
}

// -----------------------------------------------------
// Принимает либо JSON, либо multipart/form-data (с полем receipt-файлом).
// -----------------------------------------------------
type ParseResult =
  | { ok: true; value: CreateOrderInput }
  | { ok: false; statusCode: number; error: string; details?: unknown };

async function parseCreateOrderInput(req: FastifyRequest): Promise<ParseResult> {
  const ct = req.headers['content-type'] ?? '';

  if (ct.includes('multipart/form-data')) {
    const reqMulti = req as FastifyRequest & {
      parts?: () => AsyncIterable<MultipartPart>;
    };
    if (!reqMulti.parts) {
      return { ok: false, statusCode: 500, error: 'multipart_unsupported' };
    }

    let kind: 'stars' | 'premium' | null = null;
    let recipientUsername: string | null = null;
    let amount: number | null = null;
    let priceUsd: number | null = null;
    let receipt: { buffer: Buffer; mime: string } | null = null;

    for await (const part of reqMulti.parts()) {
      if (part.type === 'field') {
        const v = String(part.value);
        switch (part.fieldname) {
          case 'kind':
            if (v === 'stars' || v === 'premium') kind = v;
            break;
          case 'recipientUsername':
            recipientUsername = v.replace(/^@/, '').trim();
            break;
          case 'amount':
            amount = Number.parseInt(v, 10);
            break;
          case 'priceUsd':
            priceUsd = Number.parseFloat(v);
            break;
        }
      } else if (part.type === 'file' && part.fieldname === 'receipt') {
        const buf = await part.toBuffer();
        if (buf.byteLength > 8 * 1024 * 1024) {
          return { ok: false, statusCode: 413, error: 'file_too_large' };
        }
        receipt = { buffer: buf, mime: part.mimetype || 'application/octet-stream' };
      }
    }
    if (!kind || !recipientUsername || amount == null || priceUsd == null) {
      return { ok: false, statusCode: 400, error: 'invalid_body' };
    }
    return { ok: true, value: { kind, recipientUsername, amount, priceUsd, receipt } };
  }

  // JSON путь (без чека)
  const body = req.body as
    | {
        kind?: string;
        recipientUsername?: string;
        amount?: number;
        priceUsd?: number;
      }
    | undefined;
  if (
    !body ||
    (body.kind !== 'stars' && body.kind !== 'premium') ||
    typeof body.recipientUsername !== 'string' ||
    typeof body.amount !== 'number' ||
    typeof body.priceUsd !== 'number'
  ) {
    return { ok: false, statusCode: 400, error: 'invalid_body' };
  }
  return {
    ok: true,
    value: {
      kind: body.kind,
      recipientUsername: body.recipientUsername.replace(/^@/, '').trim(),
      amount: body.amount,
      priceUsd: body.priceUsd,
      receipt: null,
    },
  };
}

interface MultipartPart {
  type: 'field' | 'file';
  fieldname: string;
  value?: unknown;
  mimetype?: string;
  toBuffer(): Promise<Buffer>;
}

// -----------------------------------------------------
// Serialize
// -----------------------------------------------------
function serializeOrder(o: {
  id: string;
  number: number;
  kind: string;
  recipientUsername: string;
  amount: number;
  priceUsd: { toString(): string };
  status: string;
  createdAt: Date;
  paidAt: Date | null;
  deliveringAt: Date | null;
  deliveredAt: Date | null;
  receiptUrl?: string | null;
}) {
  return {
    id: o.id,
    number: o.number,
    kind: o.kind,
    recipientUsername: o.recipientUsername,
    amount: o.amount,
    priceUsd: o.priceUsd.toString(),
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    paidAt: o.paidAt?.toISOString() ?? null,
    deliveringAt: o.deliveringAt?.toISOString() ?? null,
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
    receiptUrl: o.receiptUrl ?? null,
  };
}
