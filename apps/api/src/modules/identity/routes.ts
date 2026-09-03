/**
 * Identity routes (`docs/05-api/api-contract.md` — Auth).
 *
 * Routes contain no business logic: they validate, authorize, and delegate.
 */
import type { FastifyInstance } from 'fastify';
import { requireAuth, requireActor, requireScope } from '../../http/auth.js';
import { IdentityRepository } from './repository.js';
import { getPool } from '../../db/pool.js';
import { ApiError, ErrorCode } from '../../http/errors.js';

export async function registerIdentityRoutes(app: FastifyInstance): Promise<void> {
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
