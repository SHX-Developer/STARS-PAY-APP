import { buildServer } from './server.js';
import { config } from './config.js';
import { disconnectPrisma } from './lib/prisma.js';

async function main() {
  const app = await buildServer();
  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    app.log.info(`✨ StarsPay API listening on ${config.HOST}:${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
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
