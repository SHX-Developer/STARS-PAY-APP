import { prisma } from './prisma.js';
import type { Prisma } from '@prisma/client';

// =====================================================
// Реферальный бонус: за ПЕРВЫЙ paid-заказ реферала пригласитель
// получает +REFERRAL_FIRST_ORDER_BONUS stars в баланс.
// Зачисляется ровно один раз (флаг User.referrerBonusGiven).
// =====================================================

export const REFERRAL_FIRST_ORDER_BONUS = 10;

const FULFILLED_STATUSES = ['paid', 'completed'] as const;

interface CreditResult {
  credited: boolean;
  inviterId?: string;
  amount?: number;
}

/**
 * Если у юзера есть пригласитель и это его первый paid-заказ — атомарно
 * начислить +10 stars пригласителю и поднять флаг referrerBonusGiven.
 *
 * Идемпотентно: повторный вызов после успеха ничего не делает.
 *
 * @param userId — id пользователя, который сделал заказ
 * @param tx — опционально: если уже внутри транзакции
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

    // Помечаем флаг ДО начисления через updateMany — при гонке только одна
    // транзакция получит count=1, остальные count=0 и не попадут на инкремент.
    const flag = await client.user.updateMany({
      where: { id: userId, referrerBonusGiven: false },
      data: { referrerBonusGiven: true },
    });
    if (flag.count === 0) {
      // другая транзакция уже зачислила
      return { credited: false };
    }

    await client.user.update({
      where: { id: user.referredById },
      data: { sparkleBalance: { increment: REFERRAL_FIRST_ORDER_BONUS } },
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
