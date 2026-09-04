/**
 * Identity routes (`docs/05-api/api-contract.md` — Auth).
 *
 * Routes contain no business logic: they validate, authorize, and delegate.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireActor, requireScope } from '../../http/auth.js';
import { IdentityRepository } from './repository.js';
import { DeletionRepository } from './deletion-repository.js';
import { ProviderUnavailable, type IdentityProvider } from './provider.js';
import { getPool } from '../../db/pool.js';
import { ApiError, ErrorCode, validationFailed } from '../../http/errors.js';

export type IdentityRouteDeps = { provider: IdentityProvider };

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw validationFailed(
      result.error.issues.map((issue) => ({
        field: issue.path.join('.') || '(root)',
        issue: issue.message,
      })),
    );
  }
  return result.data;
}

/**
 * An operation that needs the managed provider, when none is configured.
 *
 * 503 rather than 500: nothing is wrong with the request, and the client should
 * retry rather than treat it as permanent. Never a silent success — a sign-out
 * that does not revoke is worse than one that fails.
 */
function providerFailure(error: unknown): never {
  if (error instanceof ProviderUnavailable) {
    throw new ApiError(503, ErrorCode.serviceUnavailable, { cause: error });
  }
  throw error;
}

export async function registerIdentityRoutes(
  app: FastifyInstance,
  deps: IdentityRouteDeps,
): Promise<void> {
  const { provider } = deps;

  /**
   * Advance onboarding.
   *
   * `onboarding_state` lives on the user row and is returned by `/auth/me`, so
   * the server owns it — but nothing could WRITE it, which meant the launch
   * router would send every account back to Welcome forever. This is the only
   * writable field: the rest of the profile comes from the identity provider,
   * and letting a client patch `email` here would put two sources of truth on
   * the same value.
   */
  app.patch('/auth/me', { onRequest: requireAuth }, async (request) => {
    const actor = requireActor(request);
    const body = parseBody(
      z.object({
        onboarding_state: z.enum(['not_started', 'in_progress', 'completed', 'skipped']),
      }),
      request.body,
    );

    const repo = new IdentityRepository(getPool());
    const user = await repo.setOnboardingState(actor.userId, body.onboarding_state);
    if (!user) throw new ApiError(401, ErrorCode.accountDeleted);

    return { onboarding_state: user.onboarding_state };
  });

  /**
   * Exchange a verified provider identity for a Mira session
   * (`auth-contract.md` — Session flow).
   *
   * The provider token is verified by the same hook that guards every other
   * route, so by the time this runs the subject is already trustworthy. What
   * this adds is the Mira side: find or create the user, and their closet, so
   * the client has somewhere to land.
   *
   * It does NOT mint tokens. The provider issues and rotates them — that is
   * what "managed authentication" means, and reimplementing a rotating refresh
   * family here would be building the one part of auth most likely to be built
   * wrong.
   *
   * Idempotent: signing in twice is signing in.
   */
  app.post('/auth/session', { onRequest: requireAuth }, async (request, reply) => {
    const actor = requireActor(request);
    const scope = requireScope(request);
    const repo = new IdentityRepository(getPool());

    const user = await repo.findById(actor.userId);
    if (!user) throw new ApiError(401, ErrorCode.accountDeleted);

    const closet = (await repo.findDefaultCloset(scope)) ?? (await repo.createDefaultCloset(scope));

    // 200, not 201: the session already existed at the provider before this
    // request, and this endpoint created nothing the client did not have.
    return reply.status(200).send({
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        onboarding_state: user.onboarding_state,
        auto_import_enabled: user.auto_import_enabled,
        closet_id: closet.id,
      },
    });
  });

  /**
   * Rotate the session (`auth-contract.md` — Refresh).
   *
   * Delegated in full. A refresh token is single-use and reuse invalidates the
   * family; that detection is state the provider already keeps, and a second
   * copy here could only ever disagree with it.
   */
  app.post('/auth/refresh', async (request) => {
    const body = parseBody(z.object({ refresh_token: z.string().min(1) }), request.body);

    try {
      const session = await provider.refresh(body.refresh_token);
      return {
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
        expires_at: session.expiresAt,
      };
    } catch (error) {
      providerFailure(error);
    }
  });

  /**
   * Sign out (`auth-contract.md` — Sign-out).
   *
   * Revokes the refresh token family. The client then clears the keychain AND
   * its cached garment images — a shared device must not leak the previous
   * user's closet — which is the client's half of this and cannot be done from
   * here.
   */
  app.delete('/auth/session', { onRequest: requireAuth }, async (request, reply) => {
    const actor = requireActor(request);
    try {
      await provider.revokeSessions(actor.providerSubject);
    } catch (error) {
      providerFailure(error);
    }
    return reply.status(204).send();
  });

  /**
   * Delete the account (`auth-contract.md`, `data-retention.md` §Delete account).
   *
   * 202 and a job, because the ordered teardown spans storage buckets, the
   * provider and a dozen tables, and must be idempotent and retried. The one
   * step taken synchronously is revoking sessions: a user who has just asked to
   * be deleted should not still be signed in on another device while the job
   * works through its queue.
   *
   * The confirmation stating exactly what is removed belongs to the client, and
   * is not something this endpoint can enforce.
   */
  app.delete('/auth/account', { onRequest: requireAuth }, async (request, reply) => {
    const actor = requireActor(request);
    const pool = getPool();

    const user = await new IdentityRepository(pool).findById(actor.userId);
    if (!user) throw new ApiError(401, ErrorCode.accountDeleted);

    // Recorded BEFORE revoking, so a revoke that fails cannot lose the request.
    // A deletion the user asked for and Mira forgot is the worst outcome here.
    const deletion = await new DeletionRepository(pool).request({
      userId: actor.userId,
      providerSubject: actor.providerSubject,
      email: user.email,
    });

    try {
      await provider.revokeSessions(actor.providerSubject);
    } catch (error) {
      providerFailure(error);
    }

    return reply.status(202).send({
      deletion_id: deletion.id,
      status: deletion.status,
      requested_at: deletion.requested_at.toISOString(),
    });
  });

  app.get('/auth/me', { onRequest: requireAuth }, async (request) => {
    // The auth hook has already resolved the provider subject to a Mira user.
    const actor = requireActor(request);
    const scope = requireScope(request);
    const repo = new IdentityRepository(getPool());

    const user = await repo.findById(actor.userId);
    if (!user) throw new ApiError(401, ErrorCode.accountDeleted);

    const closet = (await repo.findDefaultCloset(scope)) ?? (await repo.createDefaultCloset(scope));

    return {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      onboarding_state: user.onboarding_state,
      auto_import_enabled: user.auto_import_enabled,
      closet_id: closet.id,
    };
  });
}
