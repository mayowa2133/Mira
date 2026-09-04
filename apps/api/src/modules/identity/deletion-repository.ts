/**
 * Account deletion records (`docs/07-security/data-retention.md`).
 *
 * Unlike every other repository here, these methods are NOT scoped by a
 * `UserScope`. The record has to outlive the user row it refers to — step 5
 * deletes the provider identity after step 4 has removed the user — so there is
 * nothing left for SEC-5 to scope against by the time the last steps run.
 *
 * The endpoint that creates a record still takes the user id from the
 * authenticated actor, never from the request body, so a user can only ever
 * request their own deletion.
 */
import type { Queryable } from '../../db/pool.js';

export type AccountDeletion = {
  id: string;
  user_id: string;
  provider_subject: string;
  email: string | null;
  status: string;
  attempts: number;
  requested_at: Date;
};

export class DeletionRepository {
  constructor(private readonly db: Queryable) {}

  /**
   * Record a deletion request.
   *
   * A second request while one is outstanding returns the FIRST record rather
   * than creating another. Deleting an account twice is not twice as deleted,
   * and two jobs racing through the same ordered teardown is a way to turn a
   * retryable failure into a confusing one.
   */
  async request(input: {
    userId: string;
    providerSubject: string;
    email: string | null;
  }): Promise<AccountDeletion> {
    const { rows } = await this.db.query<AccountDeletion>(
      `insert into account_deletions (user_id, provider_subject, email)
       values ($1, $2, $3)
       on conflict (user_id) where status in ('queued','running')
       do update set requested_at = account_deletions.requested_at
       returning id, user_id, provider_subject, email, status, attempts, requested_at`,
      [input.userId, input.providerSubject, input.email],
    );

    const row = rows[0];
    if (!row) throw new Error('account deletion request did not return a row');
    return row;
  }

  async findPending(userId: string): Promise<AccountDeletion | null> {
    const { rows } = await this.db.query<AccountDeletion>(
      `select id, user_id, provider_subject, email, status, attempts, requested_at
         from account_deletions
        where user_id = $1 and status in ('queued','running')`,
      [userId],
    );
    return rows[0] ?? null;
  }
}
