/**
 * Database integration tests.
 *
 * Run against a REAL Postgres, because constraints, triggers and row-level
 * security are the things being tested — a mock would assert nothing
 * (`docs/08-engineering/testing-strategy.md` — Principles).
 *
 *   npm run db:up && npm run db:migrate && npm test
 *
 * Skipped with a clear message when no database is reachable, so a contributor
 * without Docker still gets a green unit suite.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { IdentityRepository } from '../modules/identity/repository.js';
import { UnscopedQueryError, scopedQuery, userScope } from './scope.js';
import { loadMigrations } from './migrate.js';

const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://mira:mira@localhost:5433/mira';

let pool: pg.Pool | null = null;
let available = false;

beforeAll(async () => {
  const candidate = new pg.Pool({ connectionString: DATABASE_URL, max: 4 });
  try {
    await candidate.query('select 1');
    const { rows } = await candidate.query<{ count: string }>(
      "select count(*) as count from information_schema.tables where table_name = 'users'",
    );
    if (rows[0]?.count === '0') {
      throw new Error('migrations have not been applied — run `npm run db:migrate`');
    }
    pool = candidate;
    available = true;
  } catch {
    await candidate.end().catch(() => undefined);
    available = false;
  }
});

afterAll(async () => {
  await pool?.end();
});

const dbIt = (name: string, fn: () => Promise<void>) =>
  it(name, async () => {
    if (!available || !pool) {
      console.warn(`skipping "${name}": no migrated database at ${DATABASE_URL}`);
      return;
    }
    await fn();
  });

describe('migrations', () => {
  it('are ordered and uniquely named', () => {
    const names = loadMigrations().map((m) => m.name);
    expect(names).toEqual([...names].sort());
    expect(new Set(names).size).toBe(names.length);
  });

  it('each have a stable checksum', () => {
    for (const migration of loadMigrations()) {
      expect(migration.checksum).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  dbIt('created the foundation tables', async () => {
    const { rows } = await pool!.query<{ table_name: string }>(
      `select table_name from information_schema.tables
        where table_schema = 'public' and table_name in ('users','closets','schema_migrations')
        order by table_name`,
    );
    expect(rows.map((r) => r.table_name)).toEqual(['closets', 'schema_migrations', 'users']);
  });

  dbIt('enabled row-level security on closets (SEC-5, defence in depth)', async () => {
    const { rows } = await pool!.query<{ relrowsecurity: boolean }>(
      `select relrowsecurity from pg_class where relname = 'closets'`,
    );
    expect(rows[0]?.relrowsecurity).toBe(true);
  });

  dbIt('installed the extensions the schema depends on', async () => {
    const { rows } = await pool!.query<{ extname: string }>(
      `select extname from pg_extension where extname in ('pgcrypto','vector','citext')`,
    );
    expect(rows.map((r) => r.extname).sort()).toEqual(['citext', 'pgcrypto', 'vector']);
  });
});

describe('identity repository', () => {
  dbIt('is idempotent on repeated sign-in', async () => {
    const repo = new IdentityRepository(pool!);
    const first = await repo.upsertByProviderId({
      authProviderId: 'itest-idempotent',
      email: 'itest-idempotent@mira.local',
    });
    const second = await repo.upsertByProviderId({
      authProviderId: 'itest-idempotent',
      email: 'itest-idempotent@mira.local',
    });
    expect(second.id).toBe(first.id);
  });

  dbIt('gives a user exactly one default closet', async () => {
    const repo = new IdentityRepository(pool!);
    const user = await repo.upsertByProviderId({
      authProviderId: 'itest-closet',
      email: 'itest-closet@mira.local',
    });
    const scope = userScope(user.id);
    await repo.createDefaultCloset(scope);
    await repo.createDefaultCloset(scope);

    const { rows } = await pool!.query<{ count: string }>(
      'select count(*) as count from closets where user_id = $1 and is_default',
      [user.id],
    );
    expect(rows[0]?.count).toBe('1');
  });
});

/**
 * THE 404 RULE.
 *
 * A resource that exists but belongs to another user must be INVISIBLE, so the
 * route returns 404 rather than 403 — a 403 would confirm it exists
 * (SEC-5, `docs/05-api/error-contract.md`).
 */
describe('cross-user access (SEC-5)', () => {
  dbIt("cannot read another user's closet", async () => {
    const repo = new IdentityRepository(pool!);

    const alice = await repo.upsertByProviderId({
      authProviderId: 'itest-alice',
      email: 'alice@mira.local',
    });
    const mallory = await repo.upsertByProviderId({
      authProviderId: 'itest-mallory',
      email: 'mallory@mira.local',
    });

    const aliceCloset = await repo.createDefaultCloset(userScope(alice.id));

    // Mallory asks for Alice's closet by its real id.
    const asMallory = await repo.findClosetById(userScope(mallory.id), aliceCloset.id);

    // It is not "forbidden" — it does not exist as far as Mallory is concerned.
    expect(asMallory).toBeNull();

    // And Alice can still read her own.
    expect(await repo.findClosetById(userScope(alice.id), aliceCloset.id)).not.toBeNull();
  });

  dbIt('refuses to run a query that forgets the user filter', async () => {
    await expect(
      scopedQuery(
        pool!,
        userScope('11111111-1111-1111-1111-111111111111'),
        'select * from closets',
      ),
    ).rejects.toBeInstanceOf(UnscopedQueryError);
  });
});
