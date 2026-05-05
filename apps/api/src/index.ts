import { buildServer } from './server.js';
import { config } from './config.js';
import { disconnectPrisma } from './lib/prisma.js';
import { seedDefaultTasks } from './lib/tasks.js';
import { setupTelegramWebhook } from './lib/telegram-webhook.js';

async function main() {
  const app = await buildServer();

  // Идемпотентный seed заданий (upsert по id) — нужен чтобы FK
  // TaskCompletion → Task работал и юзеры могли начать выполнять таски.
  try {
    await seedDefaultTasks();
    app.log.info('✓ default tasks seeded');
  } catch (err) {
    app.log.error({ err }, 'failed to seed default tasks');
    // не падаем — приложение может работать без тасков
  }

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    app.log.info(`✨ StarsPay API listening on ${config.HOST}:${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  try {
    await setupTelegramWebhook(app.log);
  } catch (err) {
    app.log.error({ err }, 'failed to setup Telegram webhook');
  }

  // graceful shutdown
  const shutdown = async (sig: string) => {
    app.log.info(`Received ${sig}, shutting down…`);
    try {
      await app.close();
      await disconnectPrisma();
      process.exit(0);
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
