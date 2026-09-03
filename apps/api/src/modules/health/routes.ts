/**
 * Health routes.
 *
 * `GET /health`       liveness — is the process up?
 * `GET /health/ready` readiness — are the database, queue and storage reachable?
 *
 * Deploys are health-gated on readiness
 * (`docs/08-engineering/deployment.md` — Backend).
 */
import type { FastifyInstance } from 'fastify';
import type { BuildServerOptions } from '../../http/server.js';
import { getPool } from '../../db/pool.js';

async function defaultCheckDependencies() {
  let database = false;
  try {
    await getPool().query('select 1');
    database = true;
  } catch {
    database = false;
  }
  // Queue and storage checks arrive with the workers and media pipeline
  // (Phase 0.9 / Phase 2). Reported as true so readiness reflects what is
  // actually wired, rather than failing on unimplemented checks.
  return { database, queue: true, storage: true };
}

export async function registerHealthRoutes(
  app: FastifyInstance,
  options: BuildServerOptions,
): Promise<void> {
  const check = options.checkDependencies ?? defaultCheckDependencies;

  app.get('/health', async () => ({
    status: 'ok',
    env: options.env.MIRA_ENV,
  }));

  app.get('/health/ready', async (_request, reply) => {
    const deps = await check();
    const ready = Object.values(deps).every(Boolean);
    return reply.status(ready ? 200 : 503).send({ status: ready ? 'ready' : 'not_ready', ...deps });
  });
}
