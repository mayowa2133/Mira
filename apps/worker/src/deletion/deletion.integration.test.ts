/**
 * Account deletion (`docs/07-security/data-retention.md`).
 *
 * Against a real Postgres, because the design deliberately delegates the
 * ordered teardown to `on delete cascade` — and a test with a mocked database
 * would be asserting that the cascade works, which is the one thing it cannot
 * know.
 */
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLocalStorage, buildStorageKey } from '@mira/storage';
import {
  MAX_ATTEMPTS,
  claimNextDeletion,
  runOneDeletion,
  type DeletionDeps,
} from './delete-account.js';

const DATABASE_URL =
  process.env['TEST_DATABASE_URL'] ?? 'postgresql://mira:mira@localhost:5433/mira_test';

const storageRoot = mkdtempSync(join(tmpdir(), 'mira-del-it-'));
let pool: pg.Pool | null = null;
let available = false;

const deletedIdentities: string[] = [];
let identityFails = false;

const silent = { info: () => {}, warn: () => {}, error: () => {} };

function deps(): DeletionDeps {
  return {
    pool: pool!,
    storage: createLocalStorage({
      root: storageRoot,
      secret: 'test',
      publicBaseUrl: 'http://localhost:4000/v1',
    }),
    identity: {
      deleteIdentity: (subject) => {
        if (identityFails) return Promise.reject(new Error('provider down'));
        deletedIdentities.push(subject);
        return Promise.resolve();
      },
    },
    logger: silent,
  };
}

beforeAll(async () => {
  const candidate = new pg.Pool({ connectionString: DATABASE_URL, max: 4 });
  try {
    const { rows } = await candidate.query<{ count: string }>(
      "select count(*) as count from information_schema.tables where table_name = 'account_deletions'",
    );
    if (rows[0]?.count === '0') {
      throw new Error(
        'The test database has no account_deletions table. Run `npm run db:test:setup`.',
      );
    }
    pool = candidate;
    available = true;
  } catch (error) {
    await candidate.end().catch(() => undefined);
    // A reachable-but-stale database is a setup error, not an absent one.
    if (String(error).includes('account_deletions table')) throw error;
    available = false;
  }
});

afterAll(async () => {
  await pool
    ?.query("delete from users where auth_provider_id like 'del-it-%'")
    .catch(() => undefined);
  await pool?.query('delete from account_deletions').catch(() => undefined);
  await pool?.end();
  rmSync(storageRoot, { recursive: true, force: true });
});

const dbIt = (name: string, fn: () => Promise<void>) =>
  it(name, async () => {
    if (!available) {
      console.warn(`skipping "${name}": no database at ${DATABASE_URL}`);
      return;
    }
    deletedIdentities.length = 0;
    identityFails = false;
    await pool!.query('delete from account_deletions');
    await fn();
  });

/** A user with a closet, a garment, an image row and an object on disk. */
async function seedUser(subject: string) {
  const { rows } = await pool!.query<{ id: string }>(
    `insert into users (auth_provider_id, email) values ($1, $2) returning id`,
    [subject, `${subject}@mira.local`],
  );
  const userId = rows[0]!.id;

  const closet = await pool!.query<{ id: string }>(
    `insert into closets (user_id, name) values ($1, 'Closet') returning id`,
    [userId],
  );
  const garment = await pool!.query<{ id: string }>(
    `insert into garments (user_id, closet_id, category, source_type)
     values ($1, $2, 'tops', 'manual') returning id`,
    [userId, closet.rows[0]!.id],
  );

  const key = buildStorageKey('garments', userId, 'original.jpg');
  const storage = createLocalStorage({
    root: storageRoot,
    secret: 'test',
    publicBaseUrl: 'http://localhost:4000/v1',
  });
  await storage.put(key, Buffer.from('not really a jpeg'));

  await pool!.query(
    `insert into garment_images (garment_id, user_id, kind, storage_key) values ($1, $2, 'original', $3)`,
    [garment.rows[0]!.id, userId, key],
  );

  await pool!.query(
    `insert into account_deletions (user_id, provider_subject, email) values ($1, $2, $3)`,
    [userId, subject, `${subject}@mira.local`],
  );

  return { userId, key };
}

describe('the assumption the design rests on', () => {
  dbIt('every table carrying a user_id cascades from users', async () => {
    // The worker deletes ONE row and lets the database do the ordered teardown
    // in data-retention.md. That is only safe while this holds. A new table
    // with a user_id and no cascade would silently keep its rows after an
    // account is deleted, and this test is the thing that notices.
    const { rows } = await pool!.query<{ table_name: string; delete_rule: string | null }>(
      `select c.table_name,
              rc.delete_rule
         from information_schema.columns c
         left join information_schema.key_column_usage kcu
           on kcu.table_name = c.table_name and kcu.column_name = c.column_name
         left join information_schema.referential_constraints rc
           on rc.constraint_name = kcu.constraint_name
        where c.table_schema = 'public' and c.column_name = 'user_id'`,
    );

    const offenders = rows
      // The deletion record itself must NOT cascade: it has to outlive the
      // user row to delete the provider identity and confirm afterwards.
      .filter((r) => r.table_name !== 'account_deletions')
      .filter((r) => r.delete_rule !== 'CASCADE');

    expect(offenders.map((o) => o.table_name)).toEqual([]);
  });
});

describe('deleting an account', () => {
  dbIt('removes the user, everything cascading from them, and their objects', async () => {
    const { userId, key } = await seedUser('del-it-alice');
    expect(existsSync(join(storageRoot, key))).toBe(true);

    expect(await runOneDeletion(deps())).toBe(true);

    const user = await pool!.query('select 1 from users where id = $1', [userId]);
    expect(user.rows).toHaveLength(0);

    const garments = await pool!.query('select 1 from garments where user_id = $1', [userId]);
    expect(garments.rows).toHaveLength(0);

    const images = await pool!.query('select 1 from garment_images where user_id = $1', [userId]);
    expect(images.rows).toHaveLength(0);

    // The object, not only the row.
    expect(existsSync(join(storageRoot, key))).toBe(false);
  });

  dbIt('deletes the provider identity', async () => {
    await seedUser('del-it-bob');
    await runOneDeletion(deps());
    expect(deletedIdentities).toEqual(['del-it-bob']);
  });

  dbIt('clears the retained email, so hard delete stays true', async () => {
    await seedUser('del-it-carol');
    await runOneDeletion(deps());

    const { rows } = await pool!.query<{ status: string; email: string | null }>(
      'select status, email from account_deletions',
    );
    expect(rows[0]!.status).toBe('complete');
    expect(rows[0]!.email).toBeNull();
  });

  dbIt('does nothing when there is nothing to do', async () => {
    expect(await runOneDeletion(deps())).toBe(false);
  });

  dbIt('two workers cannot claim the same request', async () => {
    await seedUser('del-it-dana');

    const [first, second] = await Promise.all([claimNextDeletion(pool!), claimNextDeletion(pool!)]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
  });
});

describe('when it fails', () => {
  dbIt('keeps the request and retries rather than losing it', async () => {
    await seedUser('del-it-erin');
    identityFails = true;

    await runOneDeletion(deps());

    const { rows } = await pool!.query<{ status: string; attempts: number; last_error: string }>(
      'select status, attempts, last_error from account_deletions',
    );
    expect(rows[0]!.status).toBe('queued');
    expect(rows[0]!.attempts).toBe(1);
    expect(rows[0]!.last_error).toContain('provider down');
  });

  dbIt('alerts once it has exhausted its attempts', async () => {
    await seedUser('del-it-frank');
    identityFails = true;

    for (let i = 0; i < MAX_ATTEMPTS; i += 1) await runOneDeletion(deps());

    const { rows } = await pool!.query<{ status: string; alerted_at: Date | null }>(
      'select status, alerted_at from account_deletions',
    );
    expect(rows[0]!.status).toBe('failed');
    // A deletion that quietly gave up is the outcome data-retention forbids.
    expect(rows[0]!.alerted_at).not.toBeNull();
  });

  dbIt('a retry finishes the job rather than starting a second one', async () => {
    // The rows are already gone from the first attempt; every step has to be
    // "remove it if it is there" for this to work.
    await seedUser('del-it-gail');
    identityFails = true;
    await runOneDeletion(deps());

    identityFails = false;
    await runOneDeletion(deps());

    const { rows } = await pool!.query<{ status: string }>('select status from account_deletions');
    expect(rows[0]!.status).toBe('complete');
  });
});
