/**
 * Hard-delete an account (`docs/07-security/data-retention.md` — Delete account).
 *
 * The spec enumerates the tables in order. This does not, and the reason is
 * worth stating: **every user-owned table is `user_id … on delete cascade`**,
 * so deleting the user row performs that ordered teardown at the database. A
 * hardcoded list in application code would be a second copy of the schema that
 * silently forgets any table added after it was written — and forgetting a
 * table here means keeping someone's data after they asked you not to.
 *
 * What the cascade cannot do is delete storage objects or the provider
 * identity, so those are the steps that live here.
 *
 * `deletion.integration.test.ts` holds the assumption the whole design rests
 * on: every table carrying a `user_id` cascades. Add one that does not and that
 * test fails rather than this quietly leaving rows behind.
 *
 * Idempotent by construction — every step is "remove it if it is there" — which
 * matters because this is retried with backoff and may resume after a crash
 * partway through.
 */
import type { Pool } from 'pg';
import { BUCKETS, type BucketName, type StorageDriver } from '@mira/storage';

export type DeletionLogger = {
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
};

export interface IdentityDeleter {
  deleteIdentity(providerSubject: string): Promise<void>;
}

export type DeletionDeps = {
  pool: Pool;
  storage: StorageDriver;
  identity: IdentityDeleter;
  logger: DeletionLogger;
};

/** Attempts before a deletion stops retrying and alerts instead. */
export const MAX_ATTEMPTS = 5;

export type PendingDeletion = {
  id: string;
  user_id: string;
  provider_subject: string;
  attempts: number;
};

/**
 * Take the next request.
 *
 * `for update skip locked`, the same claim `ingestion_jobs` uses (D-020), so
 * two workers cannot both start tearing down the same account.
 */
export async function claimNextDeletion(pool: Pool): Promise<PendingDeletion | null> {
  const { rows } = await pool.query<PendingDeletion>(
    `update account_deletions set status = 'running', attempts = attempts + 1
      where id = (
        select id from account_deletions
         where status = 'queued' and attempts < $1
         order by requested_at
         for update skip locked
         limit 1
      )
      returning id, user_id, provider_subject, attempts`,
    [MAX_ATTEMPTS],
  );
  return rows[0] ?? null;
}

export async function deleteAccount(deps: DeletionDeps, deletion: PendingDeletion): Promise<void> {
  const { pool, storage, identity, logger } = deps;

  // Storage first. If the row deletion succeeds and this then fails, the retry
  // still finds the objects — the prefix delete needs only the user id, which
  // is on the deletion record rather than on the user row.
  let objects = 0;
  for (const bucket of Object.keys(BUCKETS) as BucketName[]) {
    objects += await storage.deletePrefix(bucket, deletion.user_id);
  }

  // One statement, one cascade. Nothing here enumerates what it removes.
  await pool.query('delete from users where id = $1', [deletion.user_id]);

  // The identity is deleted last of the destructive steps, because it is the
  // only one that cannot be retried from Mira's own records: once the user row
  // is gone, `provider_subject` survives solely on the deletion request.
  await identity.deleteIdentity(deletion.provider_subject);

  // Clearing the email is part of the deletion, not bookkeeping after it: the
  // address is retained only to send the confirmation in step 7, and a row that
  // kept it would make "hard delete" untrue.
  await pool.query(
    `update account_deletions
        set status = 'complete', completed_at = now(), email = null, last_error = null
      where id = $1`,
    [deletion.id],
  );

  logger.info('account deleted', { deletion_id: deletion.id, objects_removed: objects });
}

export async function recordDeletionFailure(
  deps: DeletionDeps,
  deletion: PendingDeletion,
  error: unknown,
): Promise<void> {
  const exhausted = deletion.attempts >= MAX_ATTEMPTS;
  const message = error instanceof Error ? error.message : String(error);

  await deps.pool.query(
    `update account_deletions
        set status = $2, last_error = $3, alerted_at = case when $4 then now() else alerted_at end
      where id = $1`,
    [deletion.id, exhausted ? 'failed' : 'queued', message, exhausted],
  );

  if (exhausted) {
    // "We failed to delete your photo" is not an acceptable silent outcome.
    deps.logger.error('account deletion exhausted its attempts', {
      deletion_id: deletion.id,
      attempts: deletion.attempts,
      error: message,
    });
  } else {
    deps.logger.warn('account deletion failed, will retry', {
      deletion_id: deletion.id,
      attempts: deletion.attempts,
      error: message,
    });
  }
}

/** One pass. Returns whether it did anything, so the caller can back off. */
export async function runOneDeletion(deps: DeletionDeps): Promise<boolean> {
  const deletion = await claimNextDeletion(deps.pool);
  if (!deletion) return false;

  try {
    await deleteAccount(deps, deletion);
  } catch (error) {
    await recordDeletionFailure(deps, deletion, error);
  }
  return true;
}
