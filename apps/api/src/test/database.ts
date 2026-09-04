import type pg from 'pg';

/**
 * Is there a database these integration tests can run against?
 *
 * The distinction that matters, and that cost a full mutation-testing round to
 * notice: **no database is a skip, a stale database is a failure.**
 *
 * Every integration file here guards itself by checking that some table it
 * needs exists, and skipping when it does not. That is right when there is no
 * Postgres at all — a laptop without Docker should not fail the suite. It is
 * wrong when Postgres is there and merely behind on migrations, because the
 * migration is in the repository: the schema being old is a setup mistake, and
 * skipping turns it into fourteen green tests that ran nothing.
 *
 * `npm test` migrates the test database first (`pretest`). Running vitest
 * directly does not, which is exactly how this happens.
 */
export type DatabaseAvailability = { available: true } | { available: false; reason: string };

export async function checkTestDatabase(
  pool: pg.Pool,
  requiredTable: string,
): Promise<DatabaseAvailability> {
  let hasTable: boolean;
  try {
    const { rows } = await pool.query<{ count: string }>(
      'select count(*) as count from information_schema.tables where table_name = $1',
      [requiredTable],
    );
    hasTable = rows[0]?.count !== '0';
  } catch (error) {
    // Could not connect at all: no environment, so skip.
    return { available: false, reason: `no database reachable (${String(error)})` };
  }

  if (!hasTable) {
    throw new Error(
      `The test database is reachable but has no "${requiredTable}" table.\n\n` +
        'That is a stale schema, not a missing environment, so this fails rather\n' +
        'than skips — skipping would report green for tests that never ran.\n\n' +
        '  npm run db:test:setup\n',
    );
  }

  return { available: true };
}
