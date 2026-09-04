/**
 * Identity repository.
 *
 * `users` is the one table keyed by the auth provider rather than by user_id,
 * so it is looked up by provider id or by its own primary key. Every OTHER
 * user-owned table is scoped through `scopedQuery` (SEC-5).
 */
import type { Queryable } from '../../db/pool.js';
import { scopedQuery, unscopedQueryForGlobalTables, type UserScope } from '../../db/scope.js';

export type UserRow = {
  id: string;
  auth_provider_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  onboarding_state: string;
  auto_import_enabled: boolean;
  deleted_at: Date | null;
};

export type ClosetRow = {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
};

export class IdentityRepository {
  constructor(private readonly db: Queryable) {}

  /**
   * Find or create the Mira user behind a verified provider subject.
   *
   * Idempotent: a repeated sign-in updates rather than duplicating.
   */
  async upsertByProviderId(input: {
    authProviderId: string;
    email: string | null;
  }): Promise<UserRow> {
    const { rows } = await unscopedQueryForGlobalTables<UserRow>(
      this.db,
      `insert into users (auth_provider_id, email)
       values ($1, $2)
       on conflict (auth_provider_id)
       do update set email = coalesce(excluded.email, users.email)
       returning id, auth_provider_id, email, display_name, avatar_url,
                 onboarding_state, auto_import_enabled, deleted_at`,
      [input.authProviderId, input.email],
    );
    const user = rows[0];
    if (!user) throw new Error('upsertByProviderId returned no row');
    return user;
  }

  async findById(id: string): Promise<UserRow | null> {
    const { rows } = await unscopedQueryForGlobalTables<UserRow>(
      this.db,
      `select id, auth_provider_id, email, display_name, avatar_url,
              onboarding_state, auto_import_enabled, deleted_at
         from users
        where id = $1 and deleted_at is null`,
      [id],
    );
    return rows[0] ?? null;
  }

  /**
   * The caller's default closet.
   *
   * Scoped: another user's closet is invisible, which is what makes the route
   * return 404 rather than 403 (`docs/05-api/error-contract.md` — the 404 rule).
   */
  async findDefaultCloset(scope: UserScope): Promise<ClosetRow | null> {
    const { rows } = await scopedQuery<ClosetRow>(
      this.db,
      scope,
      `select id, user_id, name, is_default
         from closets
        where user_id = $1 and is_default
        limit 1`,
      [scope.userId],
    );
    return rows[0] ?? null;
  }

  /** Fetch a specific closet, scoped to the caller. */
  async findClosetById(scope: UserScope, closetId: string): Promise<ClosetRow | null> {
    const { rows } = await scopedQuery<ClosetRow>(
      this.db,
      scope,
      `select id, user_id, name, is_default
         from closets
        where user_id = $1 and id = $2`,
      [scope.userId, closetId],
    );
    return rows[0] ?? null;
  }

  async createDefaultCloset(scope: UserScope): Promise<ClosetRow> {
    const { rows } = await scopedQuery<ClosetRow>(
      this.db,
      scope,
      `insert into closets (user_id, name, is_default)
       values ($1, 'My closet', true)
       on conflict (user_id) where is_default
       do update set name = closets.name
       returning id, user_id, name, is_default`,
      [scope.userId],
    );
    const closet = rows[0];
    if (!closet) throw new Error('createDefaultCloset returned no row');
    return closet;
  }

  /**
   * Record how far the user got through onboarding.
   *
   * Takes a user id rather than a `UserScope` because it is the identity
   * repository writing the identity's own row, and the id comes from the
   * verified actor — there is no other user it could reach.
   */
  async setOnboardingState(
    userId: string,
    state: 'not_started' | 'in_progress' | 'completed' | 'skipped',
  ): Promise<{ onboarding_state: string } | null> {
    const { rows } = await this.db.query<{ onboarding_state: string }>(
      `update users set onboarding_state = $2, updated_at = now()
        where id = $1 and deleted_at is null
        returning onboarding_state`,
      [userId, state],
    );
    return rows[0] ?? null;
  }
}
