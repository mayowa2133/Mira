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
import { registerImportRoutes } from '../modules/imports/routes.js';
import { ImportsRepository } from '../modules/imports/repository.js';
import { ImportsService, type JobEnqueuer } from '../modules/imports/service.js';
import { ClosetService } from '../modules/closet/service.js';
import { GarmentRepository } from '../modules/closet/repository.js';
import { IdentityRepository } from '../modules/identity/repository.js';
import { getPool } from '../db/pool.js';
import { createLocalStorage, type StorageDriver } from '../lib/storage.js';
import { resolveStorageRoot } from '../lib/storage-root.js';

/**
 * The hard cap on an uploaded image (`docs/06-ai/image-processing.md` §8).
 *
 * The client downscales to a 2048px longest edge before uploading; this is the
 * backstop for a client that does not, or is not ours.
 */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

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
  /**
   * Where background work is handed off.
   *
   * Defaults to recording the hand-off and nothing more. `ingestion_jobs` is
   * the durable record either way — that row is what makes a failure visible
   * and retryable (REL-3) — but until a shared transport exists, no worker
   * process picks the job up. See tasks/current.md.
   */
  queue?: JobEnqueuer;
};

/**
 * The default enqueuer: durable record, no transport.
 *
 * Deliberately loud rather than silent. A no-op that logged nothing would make
 * an unprocessed queue look exactly like a working one.
 */
function recordOnlyQueue(logger: Logger): JobEnqueuer {
  return {
    async enqueue(job) {
      logger.warn('job recorded but not dispatched — no queue transport configured', {
        job_type: job.type,
        user_id: job.userId,
      });
    },
  };
}

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

  /**
   * Binary upload bodies.
   *
   * Fastify parses JSON and urlencoded and rejects everything else with
   * "Unsupported Media Type" — so without this, `PUT /media/upload/*` could
   * never receive a photograph. It checked `Buffer.isBuffer(request.body)`,
   * which was unreachable: the body never became a Buffer.
   *
   * The cap here is the hard limit from `docs/06-ai/image-processing.md` §8
   * ("server rejects above the hard cap"), not the 1 MB JSON limit — a 2048px
   * capture is routinely several megabytes.
   */
  app.addContentTypeParser(
    ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'],
    { parseAs: 'buffer', bodyLimit: MAX_UPLOAD_BYTES },
    (_request, body, done) => {
      done(null, body);
    },
  );

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
          root: resolveStorageRoot(env.STORAGE_LOCAL_ROOT),
          secret: env.STORAGE_SIGNING_SECRET,
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

      const importsRepository = new ImportsRepository(pool);
      await registerImportRoutes(instance, {
        service: new ImportsService(importsRepository, garments, storage, options.queue ?? recordOnlyQueue(logger)),
        repository: importsRepository,
        identity,
      });
    },
    { prefix: '/v1' },
  );

  return app;
}
