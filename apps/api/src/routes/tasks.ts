import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { iconForKind, verifyTask, type TaskKind } from '../lib/tasks.js';

// =====================================================
// GET /api/tasks
// POST /api/tasks/:id/check
// =====================================================

interface SerializedTask {
  id: string;
  title: string;
  subtitle: string;
  reward: number;
  kind: string;
  iconKind: string;
  url: string | null;
  status: 'available' | 'completed';
}

export async function tasksRoutes(app: FastifyInstance) {
  // Список заданий с completion-статусом текущего юзера + сводка прогресса
  app.get('/tasks', { preHandler: [app.authenticate] }, async (req, _reply) => {
    const userId = (req.user as { sub: string }).sub;

    const [tasks, completions] = await Promise.all([
      prisma.task.findMany({
        where: { active: true },
        orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.taskCompletion.findMany({
        where: { userId },
        select: { taskId: true, rewardedAmount: true },
      }),
    ]);

    const completedMap = new Map(completions.map((c) => [c.taskId, c.rewardedAmount]));

    const items: SerializedTask[] = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      subtitle: t.description ?? '',
      reward: t.reward,
      kind: t.kind,
      iconKind: iconForKind(t.kind as TaskKind),
      url: t.url,
      status: completedMap.has(t.id) ? 'completed' : 'available',
    }));

    const completedCount = items.filter((i) => i.status === 'completed').length;
    const totalReward = items.reduce((s, i) => s + i.reward, 0);
    const completedReward = Array.from(completedMap.values()).reduce((s, v) => s + v, 0);

    return {
      items,
      summary: {
        completedCount,
        totalCount: items.length,
        completedReward,
        totalReward,
      },
    };
  });

  // Проверить и (если успех) пометить выполненным + начислить stars в баланс
  app.post('/tasks/:id/check', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };

    const [task, user] = await Promise.all([
      prisma.task.findUnique({ where: { id } }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, telegramId: true },
      }),
    ]);

    if (!task || !task.active) {
      reply.code(404);
      return { error: 'task_not_found' };
    }
    if (!user) {
      reply.code(401);
      return { error: 'user_not_found' };
    }

    // Уже выполнено?
    const existing = await prisma.taskCompletion.findUnique({
      where: { userId_taskId: { userId, taskId: id } },
    });
    if (existing) {
      return { ok: true, alreadyCompleted: true, awarded: 0 };
    }

    // Верификация — для channel дёргаем Bot API getChatMember,
    // для buy_* проверяем заказы в БД, для instagram self-claim.
    const verdict = await verifyTask(task.id, {
      userId: user.id,
      telegramId: user.telegramId,
    });
    if (!verdict.ok) {
      reply.code(409);
      return { ok: false, error: 'not_yet', reason: verdict.reason };
    }

    // Атомарно: записать completion + начислить stars в баланс
    const result = await prisma.$transaction(async (tx) => {
      const dup = await tx.taskCompletion.findUnique({
        where: { userId_taskId: { userId, taskId: id } },
      });
      if (dup) return { awarded: 0, alreadyCompleted: true as const };

      await tx.taskCompletion.create({
        data: { userId, taskId: id, rewardedAmount: task.reward },
      });
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { sparkleBalance: { increment: task.reward } },
        select: { sparkleBalance: true },
      });
      return {
        awarded: task.reward,
        alreadyCompleted: false as const,
        starBalance: updatedUser.sparkleBalance,
      };
    });

    return { ok: true, ...result };
  });
}
