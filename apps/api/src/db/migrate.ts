/**
 * Forward-only migration runner.
 *
 * `docs/04-data/migrations.md`:
 *   - forward-only; a mistake is fixed by a new migration, never a rollback
 *   - one concern per file, timestamp-ordered
 *   - each migration runs once, inside a transaction, recorded by checksum
 *
 * A migration whose contents change after it has been applied is an error: it
 * means history diverged between environments.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool, closePool } from './pool.js';
import { createLogger } from '../lib/logger.js';
import { isEntrypoint } from '../lib/entrypoint.js';
import { env } from '../config/env.js';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

type Migration = { name: string; sql: string; checksum: string };

export function loadMigrations(dir: string = MIGRATIONS_DIR): Migration[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((name) => {
      const sql = readFileSync(join(dir, name), 'utf8');
      return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
    });
}

export async function migrate(logger = createLogger({ level: env().LOG_LEVEL })): Promise<number> {
  const pool = getPool();
  const client = await pool.connect();
  let applied = 0;

  try {
    await client.query(`
      create table if not exists schema_migrations (
        name        text primary key,
        checksum    text not null,
        applied_at  timestamptz not null default now()
      )
    `);

    const { rows } = await client.query<{ name: string; checksum: string }>(
      'select name, checksum from schema_migrations',
    );
    const alreadyApplied = new Map<string, string>(rows.map((r) => [r.name, r.checksum]));

    for (const migration of loadMigrations()) {
      const previous = alreadyApplied.get(migration.name);

      if (previous) {
        if (previous !== migration.checksum) {
          throw new Error(
            `Migration ${migration.name} has changed since it was applied. ` +
              `Migrations are forward-only: add a new migration instead of editing this one ` +
              `(docs/04-data/migrations.md).`,
          );
        }
        continue;
      }

      logger.info('applying migration', { migration: migration.name });
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query('insert into schema_migrations (name, checksum) values ($1, $2)', [
          migration.name,
          migration.checksum,
        ]);
        await client.query('COMMIT');
        applied += 1;
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(
          `Migration ${migration.name} failed: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    logger.info('migrations complete', { applied, total: loadMigrations().length });
    return applied;
  } finally {
    client.release();
  }
}

if (isEntrypoint(import.meta.url)) {
  migrate()
    .then(async () => {
      await closePool();
      process.exit(0);
    })
    .catch(async (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      await closePool();
      process.exit(1);
    });
}
