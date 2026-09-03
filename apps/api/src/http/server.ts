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
import { bearerToken } from './auth.js';
import type { TokenVerifier } from '../modules/identity/verify.js';
import { registerHealthRoutes } from '../modules/health/routes.js';
import { registerIdentityRoutes } from '../modules/identity/routes.js';

export type BuildServerOptions = {
  env: Env;
  verifier: TokenVerifier;
  logger?: Logger;
  /** Injected for tests, so a health check can be simulated without a database. */
  checkDependencies?: () => Promise<{ database: boolean; queue: boolean; storage: boolean }>;
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
  app.addHook('onRequest', async (request) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) return;
    const verified = await verifier.verify(token);
    request.actor = { userId: verified.subject, email: verified.email };
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
    },
    { prefix: '/v1' },
  );

  return app;
}
