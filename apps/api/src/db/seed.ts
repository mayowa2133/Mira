/**
 * Seed runner.
 *
 * Seeds exist so every environment can demonstrate a believable closet
 * (`docs/04-data/seed-data.md`). Production data is NEVER copied into a lower
 * environment; seeds are synthetic.
 *
 * Seeds are idempotent: running twice produces the same database, not double
 * the rows.
 *
 * Phase 0 supports the `minimal` set (a seed user and their closet). The
 * `realistic`, `large` and `edge` sets arrive with garments in Phase 1.
 *
 *   npm run db:seed -- --set=minimal
 */
import { getPool, closePool } from './pool.js';
import { createLogger } from '../lib/logger.js';
import { isEntrypoint } from '../lib/entrypoint.js';
import { env } from '../config/env.js';

export const SEED_SETS = ['minimal', 'realistic', 'large', 'edge'] as const;
export type SeedSet = (typeof SEED_SETS)[number];

/** Seed users use @mira.local addresses and can never receive real email. */
const SEED_USERS: Record<SeedSet, { authProviderId: string; email: string; name: string }[]> = {
  minimal: [{ authProviderId: 'seed-minimal-1', email: 'maya@mira.local', name: 'Maya' }],
  realistic: [{ authProviderId: 'seed-realistic-1', email: 'maya@mira.local', name: 'Maya' }],
  large: [{ authProviderId: 'seed-large-1', email: 'perf@mira.local', name: 'Perf' }],
  edge: [
    { authProviderId: 'seed-edge-empty', email: 'empty@mira.local', name: 'Empty closet' },
    { authProviderId: 'seed-edge-single', email: 'single@mira.local', name: 'One piece' },
  ],
};

export function parseSeedSet(argv: readonly string[]): SeedSet {
  const arg = argv.find((a) => a.startsWith('--set='));
  const value = arg?.slice('--set='.length) ?? 'minimal';
  if (!(SEED_SETS as readonly string[]).includes(value)) {
    throw new Error(`Unknown seed set "${value}". Expected one of: ${SEED_SETS.join(', ')}`);
  }
  return value as SeedSet;
}

export async function seed(set: SeedSet, logger = createLogger({ level: env().LOG_LEVEL })) {
  const config = env();
  if (config.MIRA_ENV === 'production') {
    throw new Error('Refusing to seed the production environment (docs/04-data/seed-data.md).');
  }

  const pool = getPool();
  let users = 0;
  let closets = 0;

  for (const user of SEED_USERS[set]) {
    // Idempotent: re-running updates rather than inserting a duplicate.
    const { rows } = await pool.query<{ id: string }>(
      `insert into users (auth_provider_id, email, display_name, onboarding_state)
       values ($1, $2, $3, 'completed')
       on conflict (auth_provider_id)
       do update set email = excluded.email, display_name = excluded.display_name
       returning id`,
      [user.authProviderId, user.email, user.name],
    );
    const userId = rows[0]?.id;
    if (!userId) throw new Error(`failed to seed user ${user.authProviderId}`);
    users += 1;

    const closet = await pool.query(
      `insert into closets (user_id, name, is_default)
       values ($1, 'My closet', true)
       on conflict (user_id) where is_default do nothing`,
      [userId],
    );
    closets += closet.rowCount ?? 0;
  }

  if (set !== 'minimal') {
    logger.warn('seed set not fully implemented yet', {
      set,
      note: 'garment seeding arrives with the Phase 1 schema (docs/08-engineering/implementation-plan.md)',
    });
  }

  logger.info('seed complete', { set, users, closets });
  return { users, closets };
}

if (isEntrypoint(import.meta.url)) {
  const set = parseSeedSet(process.argv.slice(2));
  seed(set)
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
