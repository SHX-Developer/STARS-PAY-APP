import { prisma } from './prisma.js';
import type { Prisma } from '@prisma/client';

// =====================================================
// Реферальные бонусы пригласителю:
//   • REFERRAL_SIGNUP_BONUS — за регистрацию реферала по ссылке
//   • REFERRAL_FIRST_ORDER_BONUS — за первый paid-заказ реферала
// =====================================================

export const REFERRAL_SIGNUP_BONUS = 2;
export const REFERRAL_FIRST_ORDER_BONUS = 10;

const FULFILLED_STATUSES = ['paid', 'delivering', 'delivered', 'completed'] as const;

interface CreditResult {
  credited: boolean;
  inviterId?: string;
  amount?: number;
}

/**
 * Зачисляет +REFERRAL_SIGNUP_BONUS пригласителю при регистрации реферала.
 * Вызывается ровно один раз при создании user-а с referredById.
 *
 * Идемпотентен — если уже была транзакция с type='referral_signup' и
 * refId=referredUserId, второй раз не зачисляет.
 */
export async function creditReferralSignupBonus(
  inviterId: string,
  referredUserId: string,
  tx?: Prisma.TransactionClient,
): Promise<CreditResult> {
  const run = async (client: Prisma.TransactionClient): Promise<CreditResult> => {
    // защита от повтора
    const dup = await client.transaction.findFirst({
      where: { userId: inviterId, type: 'referral_signup', refId: referredUserId },
      select: { id: true },
    });
    if (dup) return { credited: false };

    await client.user.update({
      where: { id: inviterId },
      data: { sparkleBalance: { increment: REFERRAL_SIGNUP_BONUS } },
    });
    await client.transaction.create({
      data: {
        userId: inviterId,
        type: 'referral_signup',
        amount: REFERRAL_SIGNUP_BONUS,
        note: 'New referral joined',
        refId: referredUserId,
      },
    });
    return { credited: true, inviterId, amount: REFERRAL_SIGNUP_BONUS };
  };
  if (tx) return run(tx);
  return prisma.$transaction(run);
}

/**
 * Зачисляет +REFERRAL_FIRST_ORDER_BONUS пригласителю при первом
 * paid-заказе реферала. Race-safe через updateMany с condition.
 */
export async function maybeCreditReferralBonus(
  userId: string,
  tx?: Prisma.TransactionClient,
): Promise<CreditResult> {
  const run = async (client: Prisma.TransactionClient): Promise<CreditResult> => {
    const user = await client.user.findUnique({
      where: { id: userId },
      select: { id: true, referredById: true, referrerBonusGiven: true },
    });
    if (!user) return { credited: false };
    if (!user.referredById) return { credited: false };
    if (user.referrerBonusGiven) return { credited: false };

    const ordersCount = await client.order.count({
      where: { userId, status: { in: [...FULFILLED_STATUSES] } },
    });
    if (ordersCount < 1) return { credited: false };

    const flag = await client.user.updateMany({
      where: { id: userId, referrerBonusGiven: false },
      data: { referrerBonusGiven: true },
    });
    if (flag.count === 0) return { credited: false };

    await client.user.update({
      where: { id: user.referredById },
      data: { sparkleBalance: { increment: REFERRAL_FIRST_ORDER_BONUS } },
    });
    await client.transaction.create({
      data: {
        userId: user.referredById,
        type: 'referral',
        amount: REFERRAL_FIRST_ORDER_BONUS,
        note: 'Referral first order',
        refId: userId,
      },
    });

    return {
      credited: true,
      inviterId: user.referredById,
      amount: REFERRAL_FIRST_ORDER_BONUS,
    };
  };
  if (tx) return run(tx);
  return prisma.$transaction(run);
}
