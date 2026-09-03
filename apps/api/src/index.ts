/**
 * Mira API entrypoint.
 */
import { env } from './config/env.js';
import { createLogger } from './lib/logger.js';
import { buildServer } from './http/server.js';
import { createVerifier } from './modules/identity/verify.js';
import { closePool } from './db/pool.js';

async function main(): Promise<void> {
  const config = env();
  const logger = createLogger({
    level: config.LOG_LEVEL,
    base: { service: 'mira-api', mira_env: config.MIRA_ENV },
  });

  const app = await buildServer({ env: config, verifier: createVerifier(config), logger });

  const shutdown = async (signal: string) => {
    logger.info('shutting down', { signal });
    await app.close();
    await closePool();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ port: config.API_PORT, host: config.API_HOST });
  logger.info('api listening', { port: config.API_PORT, host: config.API_HOST });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
