/**
 * HTTP server.
 *
 * Layering (`docs/03-architecture/backend-architecture.md` §1):
 *
 *   route -> validation -> authorization -> service -> repository -> DB
 *
 * Routes contain no business logic. Errors are mapped to the error contract.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { Env } from '../config/env.js';
import { createLogger, type Logger } from '../lib/logger.js';
import { ApiError, ErrorCode, internal } from './errors.js';
import { bearerToken, type UserResolver } from './auth.js';
import type { TokenVerifier } from '../modules/identity/verify.js';
import { registerHealthRoutes } from '../modules/health/routes.js';
import { registerIdentityRoutes } from '../modules/identity/routes.js';
import { registerClosetRoutes } from '../modules/closet/routes.js';
import { registerMediaRoutes } from '../modules/media/routes.js';
import { ClosetService } from '../modules/closet/service.js';
import { GarmentRepository } from '../modules/closet/repository.js';
import { IdentityRepository } from '../modules/identity/repository.js';
import { getPool } from '../db/pool.js';
import { createLocalStorage, type StorageDriver } from '../lib/storage.js';

export type BuildServerOptions = {
  env: Env;
  verifier: TokenVerifier;
  logger?: Logger;
  /** Injected for tests, so a health check can be simulated without a database. */
  checkDependencies?: () => Promise<{ database: boolean; queue: boolean; storage: boolean }>;
  /** Injected for tests; defaults to the local filesystem driver. */
  storage?: StorageDriver;
  /** Injected for tests; defaults to resolving against the users table. */
  userResolver?: UserResolver;
};

export async function buildServer(options: BuildServerOptions): Promise<FastifyInstance> {
  const { env, verifier } = options;
  const logger = options.logger ?? createLogger({ level: env.LOG_LEVEL });

  const app = Fastify({
    // Mira's own logger owns redaction; Fastify's is disabled so no line can
    // bypass it (SEC-2, SEC-9).
    logger: false,
    genReqId: () => `req_${randomUUID()}`,
    trustProxy: true,
    bodyLimit: 1_048_576,
  });

  app.decorateRequest('actor', undefined);

  // --- correlation -------------------------------------------------------
  app.addHook('onRequest', async (request) => {
    request.log = undefined as never; // never use Fastify's logger
    (request as { startTime?: number }).startTime = Date.now();
  });

  // --- authentication ----------------------------------------------------
  // Resolves the actor when a token is present. Route guards decide whether an
  // actor is REQUIRED; this hook never rejects an anonymous request, so public
  // routes stay public.
  const userResolver: UserResolver = options.userResolver ?? {
    async resolve(providerSubject, email) {
      const repo = new IdentityRepository(getPool());
      const user = await repo.upsertByProviderId({ authProviderId: providerSubject, email });
      if (user.deleted_at) throw new ApiError(401, ErrorCode.accountDeleted);
      return { userId: user.id, providerSubject, email: user.email };
    },
  };

  app.addHook('onRequest', async (request) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) return;
    const verified = await verifier.verify(token);
    // The provider subject is NOT a Mira user id. Resolve it here, once, so no
    // downstream code can confuse the two (SEC-5, docs/05-api/auth-contract.md).
    request.actor = await userResolver.resolve(verified.subject, verified.email);
  });

  // --- access log --------------------------------------------------------
  app.addHook('onResponse', async (request, reply) => {
    const started = (request as { startTime?: number }).startTime ?? Date.now();
    logger.info('request', {
      request_id: request.id,
      user_id: request.actor?.userId ?? null,
      route: `${request.method} ${request.routeOptions.url ?? request.url}`,
      status: reply.statusCode,
      latency_ms: Date.now() - started,
    });
  });

  // --- error contract ----------------------------------------------------
  app.setErrorHandler((error: unknown, request, reply) => {
    const fastifyError = error as { statusCode?: number; validation?: unknown };
    const apiError =
      error instanceof ApiError
        ? error
        : fastifyError.statusCode === 400 || fastifyError.validation
          ? new ApiError(422, ErrorCode.validationFailed)
          : internal(error);

    if (apiError.statusCode >= 500) {
      logger.error('unhandled error', {
        request_id: request.id,
        user_id: request.actor?.userId ?? null,
        route: `${request.method} ${request.url}`,
        code: apiError.code,
        err: error,
      });
    }

    if (apiError.retryAfter !== undefined) {
      void reply.header('Retry-After', String(apiError.retryAfter));
    }
    void reply.status(apiError.statusCode).send(apiError.toBody(String(request.id)));
  });

  app.setNotFoundHandler((request, reply) => {
    void reply
      .status(404)
      .send(
        new ApiError(404, ErrorCode.internal, { message: 'Not found.' }).toBody(String(request.id)),
      );
  });

  // --- routes ------------------------------------------------------------
  await app.register(
    async (instance) => {
      await registerHealthRoutes(instance, options);
      await registerIdentityRoutes(instance);

      const storage =
        options.storage ??
        createLocalStorage({
          root: process.env['STORAGE_LOCAL_ROOT'] ?? '.mira-storage',
          secret: process.env['STORAGE_SIGNING_SECRET'] ?? 'mira-local-storage-secret',
          publicBaseUrl: `${env.API_BASE_URL}/v1`,
        });

      const pool = getPool();
      const garments = new GarmentRepository(pool);
      const identity = new IdentityRepository(pool);

      await registerClosetRoutes(instance, {
        service: new ClosetService(garments, storage),
        identity,
      });
      await registerMediaRoutes(instance, { storage });
    },
    { prefix: '/v1' },
  );

  return app;
}
